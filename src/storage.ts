import type { LunchRecord, Shop } from './types';

const DB_NAME = 'office-lunch-db';
const DB_VERSION = 3;
const RECORD_STORE_NAME = 'lunch-records';
const SHOP_STORE_NAME = 'shops';

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(RECORD_STORE_NAME)) {
        const store = db.createObjectStore(RECORD_STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: true });
      }

      if (!db.objectStoreNames.contains(SHOP_STORE_NAME)) {
        const store = db.createObjectStore(SHOP_STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      } else if (event.oldVersion < 3) {
        // v2 → v3: name インデックスを unique: false に変更し category インデックスを追加
        const transaction = request.transaction!;
        const store = transaction.objectStore(SHOP_STORE_NAME);

        if (store.indexNames.contains('name')) {
          store.deleteIndex('name');
        }
        store.createIndex('name', 'name', { unique: false });

        if (!store.indexNames.contains('category')) {
          store.createIndex('category', 'category', { unique: false });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = handler(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const getAllRecords = async () =>
  runTransaction<LunchRecord[]>(RECORD_STORE_NAME, 'readonly', (store) => store.getAll());

export const saveRecord = async (record: LunchRecord) =>
  runTransaction<IDBValidKey>(RECORD_STORE_NAME, 'readwrite', (store) => store.put(record));

export const deleteRecord = async (id: string) =>
  runTransaction<undefined>(RECORD_STORE_NAME, 'readwrite', (store) => store.delete(id));

export const getAllShops = async () =>
  runTransaction<Shop[]>(SHOP_STORE_NAME, 'readonly', (store) => store.getAll());

export const saveShop = async (shop: Shop) =>
  runTransaction<IDBValidKey>(SHOP_STORE_NAME, 'readwrite', (store) => store.put(shop));
