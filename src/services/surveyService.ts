import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SurveyData } from "@/types/survey";
import { FIREBASE_COLLECTIONS } from "@/utils/constants";

/**
 * Fetch all surveys from Firestore
 */
export async function fetchSurveys(): Promise<SurveyData[]> {
  try {
    const surveysRef = collection(db, FIREBASE_COLLECTIONS.SURVEYS);
    const q = query(surveysRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const surveys: SurveyData[] = [];
    querySnapshot.forEach((doc) => {
      surveys.push({
        id: doc.id,
        ...doc.data(),
      } as SurveyData);
    });

    return surveys;
  } catch (error) {
    console.error("Error fetching surveys:", error);
    throw error;
  }
}

/**
 * Fetch surveys with filters
 */
export async function fetchSurveysWithFilters(
  filters: QueryConstraint[]
): Promise<SurveyData[]> {
  try {
    const surveysRef = collection(db, FIREBASE_COLLECTIONS.SURVEYS);
    const q = query(surveysRef, ...filters);
    const querySnapshot = await getDocs(q);

    const surveys: SurveyData[] = [];
    querySnapshot.forEach((doc) => {
      surveys.push({
        id: doc.id,
        ...doc.data(),
      } as SurveyData);
    });

    return surveys;
  } catch (error) {
    console.error("Error fetching surveys with filters:", error);
    throw error;
  }
}

/**
 * Add a new survey to Firestore
 */
export async function addSurvey(
  surveyData: Omit<SurveyData, "id">
): Promise<string> {
  try {
    const docRef = await addDoc(
      collection(db, FIREBASE_COLLECTIONS.SURVEYS),
      {
        ...surveyData,
        createdAt: new Date().toISOString(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error("Error adding survey:", error);
    throw error;
  }
}

/**
 * Update a survey in Firestore
 */
export async function updateSurvey(
  surveyId: string,
  updates: Partial<SurveyData>
): Promise<void> {
  try {
    const surveyRef = doc(db, FIREBASE_COLLECTIONS.SURVEYS, surveyId);
    await updateDoc(surveyRef, {
      ...updates,
      modifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating survey:", error);
    throw error;
  }
}

/**
 * Delete a survey from Firestore
 */
export async function deleteSurvey(surveyId: string): Promise<void> {
  try {
    const surveyRef = doc(db, FIREBASE_COLLECTIONS.SURVEYS, surveyId);
    await deleteDoc(surveyRef);
  } catch (error) {
    console.error("Error deleting survey:", error);
    throw error;
  }
}
