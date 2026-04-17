/**
 * firebaseSync.ts
 * ───────────────
 * Syncs localStorage data to/from Firebase Firestore in the background.
 * 
 * Strategy: DUAL-WRITE
 * - All existing components keep reading/writing localStorage unchanged.
 * - This layer sits on top and:
 *   1. Pushes every localStorage write to Firestore (via patched save/load)
 *   2. Pulls Firestore changes into localStorage every 2s via onSnapshot
 *   3. Dispatches a custom 'pp-sync' event so components re-read localStorage
 * 
 * Result: zero changes to any component, full cross-device sync.
 */

import {
  collection, doc, setDoc, onSnapshot, getDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

// Keys that are synced across devices via Firestore
const SHARED_KEYS = [
  'pp_sessions',
  'pp_consumables',
  'pp_help_requests',
  'pp_active_logins',
  'pp_global_stations',
  'pp_users',
  // Settings keys (stored as individual fields in a single doc)
  'consumable_stock',
  'consumable_thresholds',
  'consumable_colors',
  'consumable_types',
  'target_orders_per_hour',
  'target_total_orders',
];

// Keys that stay LOCAL to each device (never synced)
const LOCAL_KEYS = [
  'station_name',
  'pp_device_id',
  'show_consumables',
  'enabled_consumables',
];

let isSyncing = false;

/** Write a value to Firestore */
async function pushToFirestore(key: string, value: string) {
  if (!db || !isFirebaseConfigured) return;
  try {
    // Array-type keys → stored as Firestore collection of documents
    if (['pp_sessions', 'pp_consumables', 'pp_help_requests',
         'pp_active_logins', 'pp_global_stations', 'pp_users'].includes(key)) {
      const items = JSON.parse(value);
      const ref = doc(db, 'sync', key);
      await setDoc(ref, { data: items, updated_at: Date.now() });
    } else {
      // Scalar / object keys → stored in a single settings doc
      const ref = doc(db, 'sync', 'settings');
      await setDoc(ref, { [key]: value, updated_at: Date.now() }, { merge: true });
    }
  } catch (e) {
    // Silently fail — app still works with localStorage
    console.warn('[FirebaseSync] push failed:', key, e);
  }
}

/** Pull current Firestore state into localStorage */
async function pullFromFirestore() {
  if (!db || !isFirebaseConfigured) return;
  try {
    const arrayKeys = ['pp_sessions', 'pp_consumables', 'pp_help_requests',
                       'pp_active_logins', 'pp_global_stations', 'pp_users'];
    
    // Pull array collections
    for (const key of arrayKeys) {
      const snap = await getDoc(doc(db, 'sync', key));
      if (snap.exists()) {
        const { data } = snap.data();
        const current = localStorage.getItem(key);
        const incoming = JSON.stringify(data);
        if (current !== incoming) {
          localStorage.setItem(key, incoming);
        }
      }
    }

    // Pull settings
    const settingsSnap = await getDoc(doc(db, 'sync', 'settings'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      for (const [k, v] of Object.entries(data)) {
        if (k === 'updated_at') continue;
        const current = localStorage.getItem(k);
        if (current !== v) {
          localStorage.setItem(k, v as string);
        }
      }
    }

    // Notify all components to re-read localStorage
    window.dispatchEvent(new Event('pp-sync'));
  } catch (e) {
    console.warn('[FirebaseSync] pull failed:', e);
  }
}

/** Patch localStorage.setItem to also push to Firestore */
function patchLocalStorage() {
  const originalSetItem = localStorage.setItem.bind(localStorage);
  
  localStorage.setItem = function(key: string, value: string) {
    // Always write locally first
    originalSetItem(key, value);
    
    // If it's a shared key, push to Firestore
    if (SHARED_KEYS.includes(key) && isFirebaseConfigured && !isSyncing) {
      pushToFirestore(key, value);
    }
  };
}

/** Subscribe to Firestore changes and push to localStorage in real-time */
function subscribeToFirestore() {
  if (!db || !isFirebaseConfigured) return;

  const arrayKeys = ['pp_sessions', 'pp_consumables', 'pp_help_requests',
                     'pp_active_logins', 'pp_global_stations', 'pp_users'];

  // Subscribe to each array collection
  arrayKeys.forEach(key => {
    onSnapshot(doc(db!, 'sync', key), (snap) => {
      if (!snap.exists()) return;
      const { data } = snap.data();
      const incoming = JSON.stringify(data);
      const current = localStorage.getItem(key);
      
      if (current !== incoming) {
        isSyncing = true;
        localStorage.setItem(key, incoming);
        isSyncing = false;
        // Tell components to re-render
        window.dispatchEvent(new Event('pp-sync'));
      }
    });
  });

  // Subscribe to settings
  onSnapshot(doc(db!, 'sync', 'settings'), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    let changed = false;
    
    for (const [k, v] of Object.entries(data)) {
      if (k === 'updated_at') continue;
      const current = localStorage.getItem(k);
      if (current !== v) {
        isSyncing = true;
        localStorage.setItem(k, v as string);
        isSyncing = false;
        changed = true;
      }
    }
    
    if (changed) window.dispatchEvent(new Event('pp-sync'));
  });
}

/** Seed Firestore with existing localStorage data on first run */
async function seedFirestoreIfEmpty() {
  if (!db || !isFirebaseConfigured) return;
  
  try {
    const snap = await getDoc(doc(db, 'sync', 'pp_users'));
    if (!snap.exists()) {
      // First device to connect — push all current localStorage data up
      const arrayKeys = ['pp_sessions', 'pp_consumables', 'pp_help_requests',
                         'pp_active_logins', 'pp_global_stations', 'pp_users'];
      for (const key of arrayKeys) {
        const val = localStorage.getItem(key);
        if (val) await pushToFirestore(key, val);
      }
      
      // Push settings
      const settingsKeys = ['consumable_stock', 'consumable_thresholds',
                            'consumable_colors', 'consumable_types',
                            'target_orders_per_hour', 'target_total_orders'];
      const settingsData: Record<string, string> = { updated_at: String(Date.now()) };
      settingsKeys.forEach(k => {
        const v = localStorage.getItem(k);
        if (v) settingsData[k] = v;
      });
      await setDoc(doc(db!, 'sync', 'settings'), settingsData, { merge: true });
      
      console.log('[FirebaseSync] Seeded Firestore with localStorage data');
    }
  } catch (e) {
    console.warn('[FirebaseSync] seed failed:', e);
  }
}

/** Start the sync engine */
export async function initFirebaseSync() {
  if (!isFirebaseConfigured) {
    console.log('[FirebaseSync] No Firebase config — running in localStorage-only mode');
    return;
  }

  console.log('[FirebaseSync] Initializing Firebase sync...');
  
  // 1. Patch localStorage to auto-push writes to Firestore
  patchLocalStorage();
  
  // 2. Pull current Firestore state into localStorage
  await seedFirestoreIfEmpty();
  await pullFromFirestore();
  
  // 3. Subscribe to real-time Firestore changes
  subscribeToFirestore();
  
  console.log('[FirebaseSync] ✓ Real-time sync active');
}
