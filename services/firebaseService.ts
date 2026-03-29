import { doc, getDoc, collection, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { exportAllData, importAllData } from './localStorageManager';

const CHUNK_SIZE = 800000; // 800,000 characters (~800KB) to stay safely under Firestore's 1MB limit

export const saveAiKeyToCloud = async (inspectorName: string, apiKey: string) => {
    if (!inspectorName) return;
    const metaRef = doc(db, 'backups', inspectorName);
    await setDoc(metaRef, { geminiApiKey: apiKey }, { merge: true });
};

export const loadAiKeyFromCloud = async (inspectorName: string): Promise<string | null> => {
    if (!inspectorName) return null;
    const metaRef = doc(db, 'backups', inspectorName);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().geminiApiKey) {
        return metaSnap.data().geminiApiKey;
    }
    return null;
};

export const syncToCloud = async (inspectorName: string) => {
    if (!inspectorName) throw new Error("Inspector name is required for syncing.");

    const data = exportAllData();
    const jsonString = JSON.stringify(data);

    // Split the large JSON string into smaller chunks
    const chunks: string[] = [];
    for (let i = 0; i < jsonString.length; i += CHUNK_SIZE) {
        chunks.push(jsonString.substring(i, i + CHUNK_SIZE));
    }

    // Use a batch to write all chunks atomically (up to 500 operations per batch)
    const batch = writeBatch(db);

    // 1. Update the main metadata document
    const metaRef = doc(db, 'backups', inspectorName);
    batch.set(metaRef, {
        totalChunks: chunks.length,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Write each chunk to a subcollection
    for (let i = 0; i < chunks.length; i++) {
        const chunkRef = doc(db, 'backups', inspectorName, 'chunks', i.toString());
        batch.set(chunkRef, {
            index: i,
            data: chunks[i]
        });
    }

    // Commit the batch to Firestore
    await batch.commit();
};

export const syncFromCloud = async (inspectorName: string) => {

    // 1. Get metadata
    const metaRef = doc(db, 'backups', inspectorName);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
        // Fallback: Check if they have an old backup in the previous 'users_data' collection
        const oldDocRef = doc(db, 'users_data', inspectorName);
        const oldDocSnap = await getDoc(oldDocRef);
        if (oldDocSnap.exists() && oldDocSnap.data().backupData) {
            const parsedData = JSON.parse(oldDocSnap.data().backupData);
            importAllData(parsedData);
            return true;
        }
        throw new Error("لم يتم العثور على أي نسخة احتياطية في السحابة لهذا المستخدم.");
    }

    const totalChunks = metaSnap.data().totalChunks;
    if (!totalChunks) throw new Error("بيانات النسخة الاحتياطية تالفة.");

    // 2. Get all chunks from the subcollection
    const chunksRef = collection(db, 'backups', inspectorName, 'chunks');
    const chunksSnap = await getDocs(chunksRef);

    if (chunksSnap.empty) {
        throw new Error("لم يتم العثور على أجزاء البيانات في السحابة.");
    }

    // 3. Reconstruct the JSON string
    const chunksData: { index: number, data: string }[] = [];
    chunksSnap.forEach(doc => {
        chunksData.push(doc.data() as { index: number, data: string });
    });

    // Sort by index to ensure the string is rebuilt in the exact original order
    chunksData.sort((a, b) => a.index - b.index);

    const fullJsonString = chunksData.map(c => c.data).join('');

    // 4. Parse and import
    const parsedData = JSON.parse(fullJsonString);
    
    // Merge geminiApiKey from metadata if it exists
    if (metaSnap.data().geminiApiKey) {
        parsedData.geminiApiKey = metaSnap.data().geminiApiKey;
    }
    
    importAllData(parsedData);
    return true;
};
