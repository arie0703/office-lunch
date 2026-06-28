import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  buildCalendarDays,
  formatDateKey,
  getDateLabel,
  getMonthKey,
  getMonthLabel,
  getTodayKey,
  moveMonth,
} from './dateUtils';
import { deleteRecord, getAllRecords, getAllShops, saveRecord, saveShop } from './storage';
import type { LunchCategory, LunchFormState, LunchPhoto, LunchRecord, Shop, ShopCategory } from './types';

const CATEGORY_LABELS: Record<LunchCategory, string> = {
  eat_out: '外食',
  takeout: '購入',
  home: '自炊',
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const NEW_SHOP_VALUE = '__new_shop__';

const createEmptyForm = (): LunchFormState => ({
  category: 'eat_out',
  menuName: '',
  shopId: NEW_SHOP_VALUE,
  newShopName: '',
  shopName: '',
  cost: '',
  rating: 0,
  memo: '',
});

const createFormFromRecord = (record?: LunchRecord): LunchFormState => {
  if (!record) {
    return createEmptyForm();
  }

  return {
    category: record.category,
    menuName: record.menuName ?? '',
    shopId: record.shopId ?? (record.shopName ? NEW_SHOP_VALUE : NEW_SHOP_VALUE),
    newShopName: record.shopId ? '' : (record.shopName ?? ''),
    shopName: record.shopName ?? '',
    cost: record.cost ? String(record.cost) : '',
    rating: record.rating ?? 0,
    photo: record.photo,
    memo: record.memo ?? '',
  };
};

const createId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeShopName = (name: string) => name.trim().replace(/\s+/g, ' ');

const fileToPhoto = (file: File) =>
  new Promise<LunchPhoto>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: createId(),
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const App = () => {
  const todayKey = useMemo(() => getTodayKey(), []);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [records, setRecords] = useState<LunchRecord[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [form, setForm] = useState<LunchFormState>(() => createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const recordsByDate = useMemo(
    () => new Map(records.map((record) => [record.date, record])),
    [records],
  );

  const shopsById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  // カテゴリ別の店リスト（外食・購入それぞれ独立）
  const shopsByCategory = useMemo(
    () => ({
      eat_out: shops.filter((shop) => shop.category === 'eat_out'),
      takeout: shops.filter((shop) => shop.category === 'takeout'),
    }),
    [shops],
  );

  const currentCategoryShops =
    form.category === 'eat_out' || form.category === 'takeout'
      ? shopsByCategory[form.category]
      : [];

  const selectedRecord = recordsByDate.get(selectedDateKey);
  const selectedDate = new Date(`${selectedDateKey}T00:00:00`);
  const selectedMonthKey = getMonthKey(monthDate);
  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);

  const monthlyRecords = useMemo(
    () => records.filter((record) => record.date.startsWith(selectedMonthKey)),
    [records, selectedMonthKey],
  );

  const monthlySummary = useMemo(() => {
    const recordsWithCost = monthlyRecords.filter(
      (record) => typeof record.cost === 'number' && record.cost > 0,
    );
    const total = recordsWithCost.reduce((sum, record) => sum + (record.cost ?? 0), 0);

    return {
      total,
      count: monthlyRecords.length,
      costCount: recordsWithCost.length,
      average: recordsWithCost.length > 0 ? Math.round(total / recordsWithCost.length) : 0,
    };
  }, [monthlyRecords]);

  const shopStats = useMemo(() => {
    const statsByShopId = new Map<
      string,
      {
        shop: Shop;
        useCount: number;
        costTotal: number;
        costCount: number;
        ratingTotal: number;
        ratingCount: number;
      }
    >();

    shops.forEach((shop) => {
      statsByShopId.set(shop.id, {
        shop,
        useCount: 0,
        costTotal: 0,
        costCount: 0,
        ratingTotal: 0,
        ratingCount: 0,
      });
    });

    records.forEach((record) => {
      if (!record.shopId) {
        return;
      }

      const stats = statsByShopId.get(record.shopId);
      if (!stats) {
        return;
      }

      stats.useCount += 1;

      if (typeof record.cost === 'number' && record.cost > 0) {
        stats.costTotal += record.cost;
        stats.costCount += 1;
      }

      if (typeof record.rating === 'number' && record.rating > 0) {
        stats.ratingTotal += record.rating;
        stats.ratingCount += 1;
      }
    });

    return [...statsByShopId.values()]
      .filter((stats) => stats.useCount > 0)
      .map((stats) => ({
        shop: stats.shop,
        useCount: stats.useCount,
        averageCost: stats.costCount > 0 ? Math.round(stats.costTotal / stats.costCount) : 0,
        averageRating:
          stats.ratingCount > 0 ? Math.round((stats.ratingTotal / stats.ratingCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.useCount - a.useCount || a.shop.name.localeCompare(b.shop.name, 'ja'));
  }, [records, shops]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedRecords, storedShops] = await Promise.all([getAllRecords(), getAllShops()]);
        const shopsByName = new Map(storedShops.map((shop) => [normalizeShopName(shop.name), shop]));
        const migratedRecords: LunchRecord[] = [];
        const createdShops: Shop[] = [];
        const now = new Date().toISOString();

        // v2 → v3: category フィールドがない既存 Shop に category を付与
        const migratedShops: Shop[] = [];
        for (const shop of storedShops) {
          if (!shop.category) {
            const migratedShop: Shop = { ...shop, category: 'eat_out' };
            migratedShops.push(migratedShop);
            await saveShop(migratedShop);
            shopsByName.set(normalizeShopName(migratedShop.name), migratedShop);
          } else {
            migratedShops.push(shop);
          }
        }

        for (const record of storedRecords) {
          if (record.category === 'home' || record.shopId || !record.shopName) {
            migratedRecords.push(record);
            continue;
          }

          const normalizedShopName = normalizeShopName(record.shopName);
          let shop = shopsByName.get(normalizedShopName);
          if (!shop) {
            const shopCategory: ShopCategory = record.category === 'takeout' ? 'takeout' : 'eat_out';
            shop = {
              id: createId(),
              name: normalizedShopName,
              category: shopCategory,
              createdAt: now,
              updatedAt: now,
            };
            shopsByName.set(normalizedShopName, shop);
            createdShops.push(shop);
            await saveShop(shop);
          }

          const migratedRecord = {
            ...record,
            shopId: shop.id,
            shopName: shop.name,
            updatedAt: now,
          };
          migratedRecords.push(migratedRecord);
          await saveRecord(migratedRecord);
        }

        setShops([...migratedShops, ...createdShops].sort((a, b) => a.name.localeCompare(b.name, 'ja')));
        setRecords(migratedRecords.sort((a, b) => a.date.localeCompare(b.date)));
      } catch {
        setStatusMessage('保存済みデータの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const nextForm = createFormFromRecord(selectedRecord);
    if (selectedRecord?.shopId && shopsById.has(selectedRecord.shopId)) {
      nextForm.shopId = selectedRecord.shopId;
      nextForm.newShopName = '';
      nextForm.shopName = shopsById.get(selectedRecord.shopId)?.name ?? '';
    }
    setForm(nextForm);
    setStatusMessage('');
  }, [selectedRecord, selectedDateKey, shopsById]);

  const updateForm = <K extends keyof LunchFormState>(key: K, value: LunchFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryChange = (category: LunchCategory) => {
    setForm((current) => {
      if (category === 'home') {
        return {
          ...current,
          category,
          shopId: NEW_SHOP_VALUE,
          newShopName: '',
          shopName: '',
        };
      }

      // 切り替え先カテゴリの店リストに現在の shopId が存在するか確認
      const targetShops = shopsByCategory[category as 'eat_out' | 'takeout'];
      const shopStillValid =
        current.shopId !== NEW_SHOP_VALUE && targetShops.some((s) => s.id === current.shopId);

      return {
        ...current,
        category,
        shopId: shopStillValid ? current.shopId : NEW_SHOP_VALUE,
        newShopName: shopStillValid ? '' : current.newShopName,
        shopName: shopStillValid ? current.shopName : '',
      };
    });
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatusMessage('画像ファイルを選択してください。');
      return;
    }

    try {
      const photo = await fileToPhoto(file);
      updateForm('photo', photo);
      setStatusMessage('');
    } catch {
      setStatusMessage('写真の読み込みに失敗しました。');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cost = form.cost.trim() ? Number(form.cost) : undefined;
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setStatusMessage('食事代は0以上の数値で入力してください。');
      return;
    }

    const isShopRequired = form.category !== 'home';
    const selectedShop = form.shopId !== NEW_SHOP_VALUE ? shopsById.get(form.shopId) : undefined;
    const newShopName = normalizeShopName(form.newShopName);

    if (isShopRequired && form.shopId !== NEW_SHOP_VALUE && !selectedShop) {
      setStatusMessage('店を選択してください。');
      return;
    }

    if (isShopRequired && form.shopId === NEW_SHOP_VALUE && !newShopName) {
      setStatusMessage('外食・購入の場合は店名を入力してください。');
      return;
    }

    const now = new Date().toISOString();
    let shopForRecord: Shop | undefined = selectedShop;

    if (isShopRequired && form.shopId === NEW_SHOP_VALUE) {
      const existingShop = shops.find(
        (shop) =>
          shop.category === form.category &&
          normalizeShopName(shop.name) === newShopName,
      );
      shopForRecord =
        existingShop ??
        {
          id: createId(),
          name: newShopName,
          category: form.category as ShopCategory,
          createdAt: now,
          updatedAt: now,
        };
    }

    const record: LunchRecord = {
      id: selectedRecord?.id ?? createId(),
      date: selectedDateKey,
      category: form.category,
      menuName: form.menuName.trim() || undefined,
      shopId: form.category === 'home' ? undefined : shopForRecord?.id,
      shopName: form.category === 'home' ? undefined : shopForRecord?.name,
      cost,
      rating: form.rating || undefined,
      photo: form.photo,
      memo: form.memo.trim() || undefined,
      createdAt: selectedRecord?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      if (shopForRecord && !shopsById.has(shopForRecord.id)) {
        await saveShop(shopForRecord);
        setShops((current) =>
          [...current, shopForRecord].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
        );
      }
      await saveRecord(record);
      setRecords((current) => {
        const withoutCurrent = current.filter((item) => item.id !== record.id);
        return [...withoutCurrent, record].sort((a, b) => a.date.localeCompare(b.date));
      });
      setForm((current) => ({
        ...current,
        shopId: record.shopId ?? NEW_SHOP_VALUE,
        newShopName: '',
        shopName: record.shopName ?? '',
      }));
      setStatusMessage('保存しました。');
    } catch {
      setStatusMessage('保存に失敗しました。');
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) {
      return;
    }

    try {
      await deleteRecord(selectedRecord.id);
      setRecords((current) => current.filter((record) => record.id !== selectedRecord.id));
      setForm(createEmptyForm());
      setStatusMessage('削除しました。');
    } catch {
      setStatusMessage('削除に失敗しました。');
    }
  };

  const handleMonthMove = (amount: number) => {
    setMonthDate((current) => moveMonth(current, amount));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main className="app-shell">
      <section className="top-bar" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Lunch log</p>
          <h1 id="app-title">office-lunch</h1>
        </div>
        <div className="month-switcher" aria-label="表示月の切り替え">
          <button type="button" className="icon-button" onClick={() => handleMonthMove(-1)}>
            ←
          </button>
          <strong>{getMonthLabel(monthDate)}</strong>
          <button type="button" className="icon-button" onClick={() => handleMonthMove(1)}>
            →
          </button>
        </div>
      </section>

      <section className="summary-grid" aria-label="月間サマリー">
        <div className="summary-card">
          <span>月間ランチ代</span>
          <strong>{formatCurrency(monthlySummary.total)}</strong>
        </div>
        <div className="summary-card">
          <span>記録件数</span>
          <strong>{monthlySummary.count}件</strong>
        </div>
        <div className="summary-card">
          <span>平均単価</span>
          <strong>{formatCurrency(monthlySummary.average)}</strong>
          <small>金額入力あり {monthlySummary.costCount}件</small>
        </div>
      </section>

      <section className="shop-stats-panel" aria-labelledby="shop-stats-title">
        <div className="section-heading">
          <div>
            <h2 id="shop-stats-title">店別サマリー</h2>
            <p>外食・購入で選んだ店ごとの傾向です。</p>
          </div>
        </div>

        {shopStats.length > 0 ? (
          <div className="shop-stats-list">
            {shopStats.map((stats) => (
              <article className="shop-stat-row" key={stats.shop.id}>
                <strong>{stats.shop.name}</strong>
                <span>{stats.useCount}回</span>
                <span>平均評価 {stats.averageRating ? `${stats.averageRating} / 5` : '-'}</span>
                <span>平均食事代 {stats.averageCost ? formatCurrency(stats.averageCost) : '-'}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">店を選んだ記録が入ると、ここに集計が表示されます。</p>
        )}
      </section>

      <div className="workspace">
        <section className="calendar-panel" aria-labelledby="calendar-title">
          <div className="section-heading">
            <h2 id="calendar-title">カレンダー</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const today = new Date();
                setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDateKey(todayKey);
              }}
            >
              今日
            </button>
          </div>

          <div className="weekday-row" aria-hidden="true">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const record = recordsByDate.get(day.key);
              const isSelected = day.key === selectedDateKey;
              const isToday = day.key === todayKey;

              return (
                <button
                  type="button"
                  key={day.key}
                  className={[
                    'date-cell',
                    day.isCurrentMonth ? '' : 'muted',
                    isSelected ? 'selected' : '',
                    isToday ? 'today' : '',
                    record ? `recorded recorded-${record.category}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelectedDateKey(day.key);
                    setMonthDate(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                  }}
                  aria-label={`${day.key}${record ? ' 記録あり' : ''}`}
                >
                  <span>{day.day}</span>
                  {record ? <i aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="record-panel" aria-labelledby="record-title">
          <div className="section-heading">
            <div>
              <h2 id="record-title">{getDateLabel(selectedDateKey)} の記録</h2>
              <p>{selectedRecord ? '保存済みの内容を編集できます。' : 'まだ記録がありません。'}</p>
            </div>
          </div>

          {isLoading ? (
            <p className="empty-state">読み込み中です。</p>
          ) : (
            <form className="record-form" onSubmit={handleSubmit}>
              <fieldset>
                <legend>カテゴリ</legend>
                <div className="segmented-control">
                  {(Object.keys(CATEGORY_LABELS) as LunchCategory[]).map((category) => (
                    <button
                      type="button"
                      key={category}
                      className={form.category === category ? 'active' : ''}
                      onClick={() => handleCategoryChange(category)}
                    >
                      {CATEGORY_LABELS[category]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                <span>メニュー</span>
                <input
                  value={form.menuName}
                  onChange={(event) => updateForm('menuName', event.target.value)}
                  placeholder="例: 唐揚げ定食"
                />
              </label>

              {form.category !== 'home' ? (
                <div className="shop-fields">
                  <label className="field">
                    <span>店名</span>
                    <select
                      value={form.shopId}
                      onChange={(event) => {
                        const shopId = event.target.value;
                        const shop = shopsById.get(shopId);
                        setForm((current) => ({
                          ...current,
                          shopId,
                          newShopName: shopId === NEW_SHOP_VALUE ? current.newShopName : '',
                          shopName: shop?.name ?? '',
                        }));
                      }}
                    >
                      {currentCategoryShops.length > 0 ? (
                        currentCategoryShops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))
                      ) : (
                        <option value={NEW_SHOP_VALUE}>新しい店を追加</option>
                      )}
                      {currentCategoryShops.length > 0 ? <option value={NEW_SHOP_VALUE}>新しい店を追加</option> : null}
                    </select>
                  </label>

                  {form.shopId === NEW_SHOP_VALUE ? (
                    <label className="field">
                      <span>新しい店名</span>
                      <input
                        value={form.newShopName}
                        onChange={(event) => updateForm('newShopName', event.target.value)}
                        placeholder="例: 近くの定食屋"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="form-row">
                <label className="field">
                  <span>食事代</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.cost}
                    onChange={(event) => updateForm('cost', event.target.value)}
                    placeholder="1200"
                  />
                </label>

                <fieldset className="rating-field">
                  <legend>評価</legend>
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        type="button"
                        key={rating}
                        className={form.rating >= rating ? 'filled' : ''}
                        onClick={() => updateForm('rating', form.rating === rating ? 0 : rating)}
                        aria-label={`${rating}つ星`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <label className="field">
                <span>写真</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>

              {form.photo ? (
                <div className="photo-preview">
                  <img src={form.photo.dataUrl} alt={`${getDateLabel(selectedDateKey)}のランチ`} />
                  <button type="button" className="text-button" onClick={() => updateForm('photo', undefined)}>
                    写真を削除
                  </button>
                </div>
              ) : (
                <div className="photo-placeholder">写真未登録</div>
              )}

              <label className="field">
                <span>感想メモ</span>
                <textarea
                  value={form.memo}
                  onChange={(event) => updateForm('memo', event.target.value)}
                  placeholder="味、量、混雑具合など"
                  rows={5}
                />
              </label>

              {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

              <div className="form-actions">
                {selectedRecord ? (
                  <button type="button" className="danger-button" onClick={handleDelete}>
                    削除
                  </button>
                ) : null}
                <button type="submit" className="primary-button">
                  {selectedRecord ? '更新' : '保存'}
                </button>
              </div>
            </form>
          )}

          <time dateTime={selectedDateKey} className="selected-date">
            {formatDateKey(selectedDate)}
          </time>
        </section>
      </div>
    </main>
  );
};
