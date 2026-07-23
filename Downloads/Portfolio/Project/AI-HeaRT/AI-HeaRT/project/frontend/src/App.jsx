import { useState, useRef, useEffect } from "react";

/* =========================================================================
   BACKEND API CLIENT
   Points at the ai-heart-backend Express server (see backend/README.md).
   Change API_BASE_URL to your deployed backend's URL when you go live —
   it defaults to the local dev server started with `npm run dev`.
   ========================================================================= */

const API_BASE_URL = "https://ai-heart-backend-pxrp.onrender.com";

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const err = new Error(
      "Couldn't reach the AI-HeaRT server. Make sure the backend is running (npm run dev in /backend) and reachable at " + API_BASE_URL + "."
    );
    err.code = "network_error";
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // some responses (204 No Content) have no body
  }

  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || `Request failed (${res.status})`);
    err.code = data && data.error && data.error.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

/* =========================================================================
   DATA: 100-disease dataset, merged from:
     - Diseases_and_Symptoms_dataset.csv  (symptom profiles, 96k rows -> per-
       disease characteristic symptom sets extracted by frequency analysis)
     - description.csv   (clinical descriptions)
     - precautions.csv   (precaution steps)
     - diets.csv          (dietary guidance)
     - workout.csv        (activity guidance)
     - medications.csv    (commonly used medication classes)
   Department & triage classification were assigned per-disease based on
   clinical judgement for this app; treat as a reasonable default, not a
   substitute for professional medical triage.
   ========================================================================= */

const ALL_SYMPTOMS = [
  "abnormal appearing skin", "abnormal breathing sounds", "abnormal involuntary movements",
  "abnormal movement of eyelid", "abusing alcohol", "ache all over", "acne or pimples", "allergic reaction",
  "ankle pain", "ankle swelling", "antisocial behavior", "anxiety and nervousness", "apnea", "arm lump or mass",
  "arm pain", "arm stiffness or tightness", "arm swelling", "arm weakness", "back cramps or spasms",
  "back mass or lump", "back pain", "back stiffness or tightness", "bleeding from ear", "bleeding from eye",
  "bleeding gums", "blindness", "blood clots during menstrual periods", "blood in stool", "blood in urine",
  "bones are painful", "breathing fast", "burning abdominal pain", "burning chest pain",
  "changes in stool appearance", "chest tightness", "chills", "congestion in chest", "constipation", "coryza",
  "cough", "coughing up sputum", "cramps and spasms", "decreased appetite", "decreased heart rate",
  "delusions or hallucinations", "depression", "depressive or psychotic symptoms", "diaper rash", "diarrhea",
  "difficulty breathing", "difficulty in swallowing", "difficulty speaking", "diminished hearing",
  "diminished vision", "disturbance of memory", "dizziness", "double vision", "drug abuse", "ear pain", "elbow pain",
  "elbow swelling", "excessive anger", "excessive urination at night", "eye burns or stings", "eye redness",
  "eyelid lesion or rash", "eyelid swelling", "facial pain", "fainting", "fatigue", "fears and phobias",
  "feeling ill", "fever", "flu-like syndrome", "fluid in ear", "fluid retention", "focal weakness",
  "foot or toe pain", "foot or toe swelling", "foreign body sensation in eye", "frequent menstruation",
  "frequent urination", "frontal headache", "groin pain", "gum pain", "hand or finger lump or mass",
  "hand or finger pain", "hand or finger stiffness or tightness", "hand or finger swelling",
  "hand or finger weakness", "headache", "heartburn", "heavy menstrual flow", "hemoptysis", "hesitancy", "hip pain",
  "hip stiffness or tightness", "hoarse voice", "hostile behavior", "hot flashes", "hurts to breath",
  "hysterical behavior", "impotence", "increased heart rate", "infant feeding problem", "infertility", "insomnia",
  "intermenstrual bleeding", "involuntary urination", "irregular appearing nails", "irregular appearing scalp",
  "irregular heartbeat", "irritable infant", "itchiness of eye", "itching of skin", "itching of the anus",
  "itchy ear(s)", "itchy scalp", "jaundice", "jaw swelling", "joint pain", "kidney mass", "knee pain",
  "knee stiffness or tightness", "knee swelling", "lack of growth", "lacrimation", "leg pain", "leg swelling",
  "leg weakness", "lip swelling", "long menstrual periods", "loss of sensation", "low back pain", "low self-esteem",
  "low urine output", "lower abdominal pain", "lower body pain", "mass on eyelid",
  "mass or swelling around the anus", "melena", "mouth dryness", "mouth pain", "mouth ulcer", "nasal congestion",
  "nausea", "neck mass", "neck pain", "neck swelling", "nosebleed", "obsessions and compulsions",
  "pain during intercourse", "pain during pregnancy", "pain in eye", "pain in gums", "pain in testicles",
  "pain of the anus", "painful menstruation", "painful sinuses", "painful urination", "palpitations", "paresthesia",
  "pelvic pain", "peripheral edema", "plugged feeling in ear", "problems during pregnancy", "problems with movement",
  "pulling at ears", "pus draining from ear", "recent pregnancy", "rectal bleeding", "redness in ear",
  "regurgitation", "restlessness", "retention of urine", "rib pain", "ringing in ear", "seizures",
  "sharp abdominal pain", "sharp chest pain", "shortness of breath", "shoulder pain",
  "shoulder stiffness or tightness", "side pain", "sinus congestion",
  "skin dryness, peeling, scaliness, or roughness", "skin growth", "skin irritation", "skin lesion", "skin moles",
  "skin rash", "skin swelling", "sleepiness", "sneezing", "sore throat", "spots or clouds in vision",
  "spotting or bleeding during pregnancy", "stomach bloating", "suprapubic pain", "sweating", "swelling of scrotum",
  "swollen eye", "swollen or red tonsils", "symptoms of bladder", "symptoms of eye", "symptoms of prostate",
  "symptoms of the face", "symptoms of the kidneys", "symptoms of the scrotum and testes", "temper problems",
  "throat swelling", "toothache", "unpredictable menstruation", "unusual color or odor to urine",
  "upper abdominal pain", "uterine contractions", "vaginal discharge", "vaginal itching", "vaginal pain",
  "vaginal redness", "vomiting", "vomiting blood", "warts", "weakness", "weight gain", "wheezing",
  "white discharge from eye", "wrist pain", "wrist swelling",
];

const DISEASE_DB = [
  { name: "Panic disorder", symptoms: ["depressive or psychotic symptoms", "dizziness", "insomnia", "abnormal involuntary movements", "breathing fast", "chest tightness", "anxiety and nervousness", "palpitations", "irregular heartbeat", "shortness of breath", "depression"], triage: "yellow", description: "Panic disorder is a mental health condition marked by sudden, unexpected panic attacks—intense periods of fear or discomfort—often accompanied by physical symptoms like chest pain, rapid heartbeat, shortness of breath, or dizziness.", overview: "Panic disorder is a mental health condition marked by sudden, unexpected panic attacks—intense periods of fear or discomfort—often accompanied by physical symptoms like chest pain, rapid heartbeat, shortness of breath, or dizziness. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Psychiatry, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Psychiatry" },
  { name: "Vaginitis", symptoms: ["pain during intercourse", "lower abdominal pain", "vaginal pain", "vaginal discharge", "pelvic pain", "suprapubic pain", "sharp abdominal pain", "painful urination", "vaginal redness", "pain during pregnancy", "vaginal itching"], triage: "green", description: "Vaginitis is inflammation of the vaginal tissue, typically caused by infections (bacterial, fungal, or parasitic), hormonal imbalances, or irritants, resulting in discharge, itching, pain, or burning during urination.", overview: "Vaginitis is inflammation of the vaginal tissue, typically caused by infections (bacterial, fungal, or parasitic), hormonal imbalances, or irritants, resulting in discharge, itching, pain, or burning during urination. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gynecology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gynecology" },
  { name: "Problem during pregnancy", symptoms: ["pelvic pain", "lower abdominal pain", "back pain", "problems during pregnancy", "spotting or bleeding during pregnancy", "nausea", "pain during pregnancy", "vomiting", "cramps and spasms", "headache", "sharp abdominal pain"], triage: "red", description: "Problems during pregnancy refer to medical complications such as gestational diabetes, preeclampsia, or fetal growth restriction that can affect the health of the mother or baby during gestation.", overview: "Problems during pregnancy refer to medical complications such as gestational diabetes, preeclampsia, or fetal growth restriction that can affect the health of the mother or baby during gestation. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Obstetrics, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Obstetrics" },
  { name: "Acute pancreatitis", symptoms: ["burning abdominal pain", "nausea", "vomiting", "abusing alcohol", "hemoptysis", "diarrhea", "upper abdominal pain", "back pain", "sharp abdominal pain", "lower body pain", "side pain", "sharp chest pain"], triage: "red", description: "Acute pancreatitis is a sudden inflammation of the pancreas that causes severe abdominal pain, nausea, vomiting, and elevated pancreatic enzymes, often due to gallstones or alcohol use.", overview: "Acute pancreatitis is a sudden inflammation of the pancreas that causes severe abdominal pain, nausea, vomiting, and elevated pancreatic enzymes, often due to gallstones or alcohol use. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Gastroenterology, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Gastroenterology" },
  { name: "Asthma", symptoms: ["coughing up sputum", "nasal congestion", "cough", "allergic reaction", "difficulty breathing", "wheezing", "fever", "coryza", "sharp chest pain", "chest tightness", "shortness of breath"], triage: "yellow", description: "Asthma is a chronic inflammatory disease of the airways causing recurrent wheezing, breathlessness, chest tightness, and coughing, often triggered by allergens, exercise, or cold air.", overview: "Asthma is a chronic inflammatory disease of the airways causing recurrent wheezing, breathlessness, chest tightness, and coughing, often triggered by allergens, exercise, or cold air. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pulmonology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pulmonology" },
  { name: "Infectious gastroenteritis", symptoms: ["nausea", "decreased appetite", "diarrhea", "headache", "chills", "vomiting", "burning abdominal pain", "fever", "sharp abdominal pain", "fluid retention", "flu-like syndrome", "blood in stool"], triage: "yellow", description: "Infectious gastroenteritis is an intestinal infection caused by viruses, bacteria, or parasites, leading to symptoms like diarrhea, vomiting, abdominal cramps, and fever.", overview: "Infectious gastroenteritis is an intestinal infection caused by viruses, bacteria, or parasites, leading to symptoms like diarrhea, vomiting, abdominal cramps, and fever. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gastroenterology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gastroenterology" },
  { name: "Acute sinusitis", symptoms: ["sore throat", "coryza", "sinus congestion", "ear pain", "frontal headache", "cough", "facial pain", "coughing up sputum", "fever", "nasal congestion", "painful sinuses"], triage: "green", description: "Acute sinusitis is a temporary inflammation or infection of the sinuses, usually following a cold, causing nasal congestion, facial pain, pressure, and headache.", overview: "Acute sinusitis is a temporary inflammation or infection of the sinuses, usually following a cold, causing nasal congestion, facial pain, pressure, and headache. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under ENT, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "ENT" },
  { name: "Cornea infection", symptoms: ["lip swelling", "spots or clouds in vision", "diminished vision", "eye burns or stings", "symptoms of eye", "pain in eye", "itchiness of eye", "eye redness", "foreign body sensation in eye", "lacrimation", "swollen eye"], triage: "yellow", description: "Cornea infection (keratitis) is an infection of the transparent front part of the eye, usually caused by bacteria, fungi, or viruses, leading to eye pain, redness, blurred vision, and light sensitivity.", overview: "Cornea infection (keratitis) is an infection of the transparent front part of the eye, usually caused by bacteria, fungi, or viruses, leading to eye pain, redness, blurred vision, and light sensitivity. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Ophthalmology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Ophthalmology" },
  { name: "Marijuana abuse", symptoms: ["abusing alcohol", "excessive anger", "low self-esteem", "hostile behavior", "fears and phobias", "drug abuse", "depressive or psychotic symptoms", "depression", "delusions or hallucinations", "difficulty speaking", "temper problems", "anxiety and nervousness"], triage: "yellow", description: "Marijuana abuse refers to the excessive or harmful use of cannabis, which can lead to cognitive impairment, altered judgment, addiction, and long-term mental health issues.", overview: "Marijuana abuse refers to the excessive or harmful use of cannabis, which can lead to cognitive impairment, altered judgment, addiction, and long-term mental health issues. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Addiction Medicine, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Addiction Medicine" },
  { name: "Bursitis", symptoms: ["elbow swelling", "knee pain", "hip pain", "arm swelling", "arm pain", "elbow pain", "arm stiffness or tightness", "knee swelling", "shoulder stiffness or tightness", "leg pain", "leg swelling", "shoulder pain"], triage: "green", description: "Bursitis is inflammation of the bursae—small fluid-filled sacs that cushion bones and joints—causing joint pain, swelling, and limited movement, often from repetitive motion or pressure.", overview: "Bursitis is inflammation of the bursae—small fluid-filled sacs that cushion bones and joints—causing joint pain, swelling, and limited movement, often from repetitive motion or pressure. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Orthopedics, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Orthopedics" },
  { name: "Actinic keratosis", symptoms: ["symptoms of the face", "irregular appearing scalp", "skin dryness, peeling, scaliness, or roughness", "skin moles", "itching of skin", "skin rash", "skin growth", "abnormal appearing skin", "skin irritation", "skin lesion", "skin swelling"], triage: "green", description: "Actinic keratosis is a rough, scaly patch on the skin caused by prolonged sun exposure, and is considered a precancerous condition that can develop into squamous cell carcinoma.", overview: "Actinic keratosis is a rough, scaly patch on the skin caused by prolonged sun exposure, and is considered a precancerous condition that can develop into squamous cell carcinoma. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Chronic obstructive pulmonary disease (COPD)", symptoms: ["sharp chest pain", "coughing up sputum", "coryza", "cough", "nasal congestion", "wheezing", "fever", "congestion in chest", "sore throat", "chest tightness", "shortness of breath"], triage: "yellow", description: "COPD is a group of progressive lung diseases, including emphysema and chronic bronchitis, characterized by airflow limitation, coughing, wheezing, and shortness of breath.", overview: "COPD is a group of progressive lung diseases, including emphysema and chronic bronchitis, characterized by airflow limitation, coughing, wheezing, and shortness of breath. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pulmonology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pulmonology" },
  { name: "Spondylosis", symptoms: ["neck pain", "low back pain", "ache all over", "back pain", "arm pain", "loss of sensation", "hip pain", "lower body pain", "knee pain", "shoulder pain", "paresthesia", "leg pain"], triage: "green", description: "Spondylosis is a degenerative condition affecting the spine due to aging, resulting in stiffness, pain, and reduced mobility due to wear and tear on spinal discs and joints.", overview: "Spondylosis is a degenerative condition affecting the spine due to aging, resulting in stiffness, pain, and reduced mobility due to wear and tear on spinal discs and joints. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Orthopedics, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Orthopedics" },
  { name: "Injury to the arm", symptoms: ["wrist swelling", "loss of sensation", "elbow swelling", "arm stiffness or tightness", "elbow pain", "joint pain", "arm pain", "bones are painful", "wrist pain", "arm swelling", "hand or finger swelling", "hand or finger pain"], triage: "yellow", description: "Injury to the arm refers to damage to muscles, bones, ligaments, or skin in the arm area from trauma, leading to pain, swelling, bruising, or limited movement.", overview: "Injury to the arm refers to damage to muscles, bones, ligaments, or skin in the arm area from trauma, leading to pain, swelling, bruising, or limited movement. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Complex regional pain syndrome", symptoms: ["back pain", "foot or toe pain", "neck pain", "leg pain", "arm pain", "hand or finger pain", "paresthesia", "low back pain", "loss of sensation", "abnormal involuntary movements", "ache all over", "problems with movement"], triage: "yellow", description: "Complex regional pain syndrome (CRPS) is a chronic pain condition usually affecting a limb after injury, with symptoms including burning pain, swelling, and sensitivity to touch.", overview: "Complex regional pain syndrome (CRPS) is a chronic pain condition usually affecting a limb after injury, with symptoms including burning pain, swelling, and sensitivity to touch. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Neurology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Neurology" },
  { name: "Injury to the trunk", symptoms: ["symptoms of the scrotum and testes", "neck pain", "shoulder pain", "lower body pain", "back pain", "low back pain", "rib pain", "headache", "bones are painful", "wrist pain", "sharp chest pain"], triage: "yellow", description: "Injury to the trunk includes trauma to the chest, abdomen, or back areas, possibly involving internal organs, muscles, or bones, and can range from minor bruises to serious internal damage.", overview: "Injury to the trunk includes trauma to the chest, abdomen, or back areas, possibly involving internal organs, muscles, or bones, and can range from minor bruises to serious internal damage. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics / Emergency, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics / Emergency" },
  { name: "Vulvodynia", symptoms: ["back pain", "vaginal discharge", "lower abdominal pain", "nausea", "pelvic pain", "pain during pregnancy", "painful urination", "side pain", "burning abdominal pain", "cramps and spasms", "sharp abdominal pain", "vaginal pain"], triage: "green", description: "Vulvodynia is chronic pain or discomfort around the opening of the vagina (vulva) with no identifiable cause, often described as burning, stinging, or irritation.", overview: "Vulvodynia is chronic pain or discomfort around the opening of the vagina (vulva) with no identifiable cause, often described as burning, stinging, or irritation. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gynecology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gynecology" },
  { name: "Concussion", symptoms: ["nausea", "headache", "disturbance of memory", "double vision", "back pain", "facial pain", "sleepiness", "rib pain", "vomiting", "neck pain", "difficulty speaking", "dizziness"], triage: "yellow", description: "A concussion is a mild traumatic brain injury caused by a blow to the head or body, resulting in temporary loss of brain function, such as confusion, memory loss, or dizziness.", overview: "A concussion is a mild traumatic brain injury caused by a blow to the head or body, resulting in temporary loss of brain function, such as confusion, memory loss, or dizziness. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Neurology / Emergency, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Neurology / Emergency" },
  { name: "Hypoglycemia", symptoms: ["feeling ill", "nausea", "seizures", "fainting", "sweating", "abnormal involuntary movements", "sleepiness", "dizziness", "weakness", "problems with movement", "decreased appetite", "depressive or psychotic symptoms"], triage: "red", description: "Hypoglycemia is a condition characterized by abnormally low blood sugar levels, often causing shakiness, sweating, confusion, irritability, or fainting, common in diabetics on insulin.", overview: "Hypoglycemia is a condition characterized by abnormally low blood sugar levels, often causing shakiness, sweating, confusion, irritability, or fainting, common in diabetics on insulin. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Endocrinology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Endocrinology / Emergency" },
  { name: "Hiatal hernia", symptoms: ["difficulty in swallowing", "sharp abdominal pain", "upper abdominal pain", "nausea", "back pain", "dizziness", "burning abdominal pain", "heartburn", "regurgitation", "vomiting blood", "sharp chest pain"], triage: "yellow", description: "A hiatal hernia occurs when the upper part of the stomach pushes through the diaphragm into the chest cavity, often causing symptoms like heartburn, reflux, and chest pain.", overview: "A hiatal hernia occurs when the upper part of the stomach pushes through the diaphragm into the chest cavity, often causing symptoms like heartburn, reflux, and chest pain. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gastroenterology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gastroenterology" },
  { name: "Allergy", symptoms: ["fluid retention", "peripheral edema", "allergic reaction", "skin swelling", "itching of skin", "itchiness of eye", "skin rash", "abnormal appearing skin", "lip swelling", "cough", "swollen eye"], triage: "green", description: "An allergy is an overreaction of the immune system to substances like pollen, food, or medications, causing symptoms like sneezing, itching, rash, or anaphylaxis.", overview: "An allergy is an overreaction of the immune system to substances like pollen, food, or medications, causing symptoms like sneezing, itching, rash, or anaphylaxis. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Allergy & Immunology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Allergy & Immunology" },
  { name: "Acute bronchospasm", symptoms: ["vomiting", "cough", "difficulty breathing", "sore throat", "wheezing", "nasal congestion", "sharp chest pain", "chest tightness", "fever", "coryza", "shortness of breath"], triage: "yellow", description: "Acute bronchospasm is a sudden constriction of the muscles in the walls of the bronchioles, often triggered by asthma or allergens, causing wheezing and difficulty breathing.", overview: "Acute bronchospasm is a sudden constriction of the muscles in the walls of the bronchioles, often triggered by asthma or allergens, causing wheezing and difficulty breathing. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pulmonology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pulmonology" },
  { name: "Degenerative disc disease", symptoms: ["shoulder pain", "neck pain", "low back pain", "joint pain", "lower body pain", "loss of sensation", "hip pain", "paresthesia", "back pain", "leg pain", "arm pain"], triage: "yellow", description: "Degenerative disc disease is a condition where spinal discs break down over time, leading to back pain, reduced flexibility, and sometimes nerve compression.", overview: "Degenerative disc disease is a condition where spinal discs break down over time, leading to back pain, reduced flexibility, and sometimes nerve compression. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Pain after an operation", symptoms: ["leg pain", "nausea", "low back pain", "headache", "back pain", "neck pain", "vomiting", "side pain", "lower abdominal pain", "sharp chest pain", "sharp abdominal pain"], triage: "yellow", description: "Pain after an operation (postoperative pain) is discomfort or soreness at the surgical site, which may be due to tissue injury, inflammation, or healing processes.", overview: "Pain after an operation (postoperative pain) is discomfort or soreness at the surgical site, which may be due to tissue injury, inflammation, or healing processes. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within General Surgery, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "General Surgery" },
  { name: "Injury to the leg", symptoms: ["leg swelling", "problems with movement", "knee swelling", "knee pain", "ankle swelling", "foot or toe pain", "foot or toe swelling", "ankle pain", "leg pain", "irregular appearing nails", "infant feeding problem", "knee stiffness or tightness"], triage: "yellow", description: "Injury to the leg includes trauma to any part of the leg such as the thigh, knee, shin, or ankle, potentially involving muscles, bones, or ligaments.", overview: "Injury to the leg includes trauma to any part of the leg such as the thigh, knee, shin, or ankle, potentially involving muscles, bones, or ligaments. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Gout", symptoms: ["knee pain", "foot or toe pain", "knee swelling", "foot or toe swelling", "wrist swelling", "ankle pain", "ankle swelling", "hand or finger swelling", "wrist pain", "joint pain", "hand or finger pain", "leg swelling"], triage: "yellow", description: "Gout is a form of inflammatory arthritis caused by buildup of uric acid crystals in joints, leading to sudden, severe pain, redness, and swelling, often in the big toe.", overview: "Gout is a form of inflammatory arthritis caused by buildup of uric acid crystals in joints, leading to sudden, severe pain, redness, and swelling, often in the big toe. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Rheumatology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Rheumatology" },
  { name: "Otitis media", symptoms: ["vomiting", "ear pain", "coryza", "diminished hearing", "sore throat", "plugged feeling in ear", "fever", "nasal congestion", "cough", "pulling at ears", "fluid in ear"], triage: "green", description: "Otitis media is a middle ear infection that commonly affects children, causing ear pain, fever, irritability, and sometimes fluid discharge from the ear.", overview: "Otitis media is a middle ear infection that commonly affects children, causing ear pain, fever, irritability, and sometimes fluid discharge from the ear. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under ENT, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "ENT" },
  { name: "Acute kidney injury", symptoms: ["retention of urine", "vomiting", "weakness", "nausea", "sharp abdominal pain", "kidney mass", "peripheral edema", "sharp chest pain", "shortness of breath", "dizziness", "symptoms of the kidneys"], triage: "red", description: "Acute kidney injury (AKI) is a sudden loss of kidney function due to illness, injury, or toxins, leading to buildup of waste products in the blood.", overview: "Acute kidney injury (AKI) is a sudden loss of kidney function due to illness, injury, or toxins, leading to buildup of waste products in the blood. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Nephrology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Nephrology / Emergency" },
  { name: "Threatened pregnancy", symptoms: ["sharp abdominal pain", "cramps and spasms", "lower abdominal pain", "problems during pregnancy", "pelvic pain", "intermenstrual bleeding", "back pain", "spotting or bleeding during pregnancy", "uterine contractions", "blood clots during menstrual periods", "vaginal discharge"], triage: "red", description: "A threatened pregnancy refers to early pregnancy complications, such as vaginal bleeding or cramping, that may suggest a risk of miscarriage but with a still viable fetus.", overview: "A threatened pregnancy refers to early pregnancy complications, such as vaginal bleeding or cramping, that may suggest a risk of miscarriage but with a still viable fetus. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Obstetrics / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Obstetrics / Emergency" },
  { name: "Gum disease", symptoms: ["mouth ulcer", "toothache", "ear pain", "gum pain", "facial pain", "jaw swelling", "peripheral edema", "bleeding gums", "fever", "pain in gums", "lip swelling"], triage: "green", description: "Gum disease (periodontal disease) is an infection and inflammation of the gums and surrounding tissues, often caused by poor oral hygiene, leading to bleeding, receding gums, and tooth loss.", overview: "Gum disease (periodontal disease) is an infection and inflammation of the gums and surrounding tissues, often caused by poor oral hygiene, leading to bleeding, receding gums, and tooth loss. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dentistry, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dentistry" },
  { name: "Gastrointestinal hemorrhage", symptoms: ["blood in stool", "rectal bleeding", "sharp abdominal pain", "vomiting", "nausea", "vomiting blood", "fainting", "changes in stool appearance", "diarrhea", "melena", "weakness", "dizziness"], triage: "red", description: "Gastrointestinal hemorrhage is bleeding that occurs anywhere along the digestive tract, often presenting as vomiting blood or black, tarry stools, and can be caused by ulcers, varices, or cancer.", overview: "Gastrointestinal hemorrhage is bleeding that occurs anywhere along the digestive tract, often presenting as vomiting blood or black, tarry stools, and can be caused by ulcers, varices, or cancer. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Gastroenterology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Gastroenterology / Emergency" },
  { name: "Anxiety", symptoms: ["sharp chest pain", "depressive or psychotic symptoms", "insomnia", "depression", "abnormal involuntary movements", "headache", "irregular heartbeat", "shortness of breath", "fears and phobias", "palpitations", "increased heart rate", "anxiety and nervousness"], triage: "yellow", description: "Anxiety is a mental health condition characterized by excessive worry, nervousness, or fear that interferes with daily activities, often accompanied by physical symptoms like restlessness, sweating, or rapid heartbeat.", overview: "Anxiety is a mental health condition characterized by excessive worry, nervousness, or fear that interferes with daily activities, often accompanied by physical symptoms like restlessness, sweating, or rapid heartbeat. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Psychiatry, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Psychiatry" },
  { name: "Conjunctivitis due to allergy", symptoms: ["eye redness", "sneezing", "itchiness of eye", "nasal congestion", "symptoms of eye", "pain in eye", "lacrimation", "swollen eye", "allergic reaction", "diminished vision", "eye burns or stings", "cough"], triage: "green", description: "Allergic conjunctivitis is inflammation of the conjunctiva (eye lining) caused by allergens like pollen or dust, leading to red, itchy, watery eyes without infectious discharge.", overview: "Allergic conjunctivitis is inflammation of the conjunctiva (eye lining) caused by allergens like pollen or dust, leading to red, itchy, watery eyes without infectious discharge. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Ophthalmology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Ophthalmology" },
  { name: "Drug reaction", symptoms: ["nausea", "allergic reaction", "skin rash", "peripheral edema", "headache", "vomiting", "abnormal appearing skin", "dizziness", "itching of skin", "throat swelling", "shortness of breath"], triage: "yellow", description: "A drug reaction is an adverse response to a medication, ranging from mild rashes or stomach upset to severe allergic responses like Stevens-Johnson syndrome or anaphylaxis.", overview: "A drug reaction is an adverse response to a medication, ranging from mild rashes or stomach upset to severe allergic responses like Stevens-Johnson syndrome or anaphylaxis. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Internal Medicine, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Internal Medicine" },
  { name: "Macular degeneration", symptoms: ["double vision", "foreign body sensation in eye", "blindness", "lacrimation", "abnormal movement of eyelid", "spots or clouds in vision", "bleeding from eye", "diminished vision", "pain in eye", "symptoms of eye", "itchiness of eye"], triage: "yellow", description: "Macular degeneration is an eye disorder that damages the macula, the part of the retina responsible for central vision, leading to blurred or loss of central vision, typically in older adults.", overview: "Macular degeneration is an eye disorder that damages the macula, the part of the retina responsible for central vision, leading to blurred or loss of central vision, typically in older adults. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Ophthalmology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Ophthalmology" },
  { name: "Pneumonia", symptoms: ["vomiting", "cough", "nasal congestion", "weakness", "sore throat", "sharp chest pain", "wheezing", "difficulty breathing", "chills", "coryza", "fever", "shortness of breath"], triage: "red", description: "Pneumonia is an infection of the lungs caused by bacteria, viruses, or fungi, resulting in cough, fever, chest pain, and difficulty breathing due to inflammation and fluid in the lungs.", overview: "Pneumonia is an infection of the lungs caused by bacteria, viruses, or fungi, resulting in cough, fever, chest pain, and difficulty breathing due to inflammation and fluid in the lungs. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Pulmonology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Pulmonology / Emergency" },
  { name: "Vaginal cyst", symptoms: ["heavy menstrual flow", "pelvic pain", "lower abdominal pain", "intermenstrual bleeding", "pain during pregnancy", "vaginal pain", "cramps and spasms", "blood clots during menstrual periods", "vaginal discharge", "problems during pregnancy", "spotting or bleeding during pregnancy", "sharp abdominal pain"], triage: "green", description: "A vaginal cyst is a fluid-filled sac that forms along the vaginal wall, often benign and asymptomatic, but can sometimes cause discomfort or pain if enlarged or infected.", overview: "A vaginal cyst is a fluid-filled sac that forms along the vaginal wall, often benign and asymptomatic, but can sometimes cause discomfort or pain if enlarged or infected. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gynecology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gynecology" },
  { name: "Carpal tunnel syndrome", symptoms: ["elbow pain", "loss of sensation", "wrist swelling", "neck pain", "wrist pain", "paresthesia", "arm pain", "arm weakness", "hand or finger pain", "hand or finger stiffness or tightness", "hand or finger swelling"], triage: "green", description: "Carpal tunnel syndrome is a condition caused by compression of the median nerve in the wrist, leading to numbness, tingling, and weakness in the hand and fingers.", overview: "Carpal tunnel syndrome is a condition caused by compression of the median nerve in the wrist, leading to numbness, tingling, and weakness in the hand and fingers. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Orthopedics, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Orthopedics" },
  { name: "Nose disorder", symptoms: ["ear pain", "nosebleed", "facial pain", "difficulty breathing", "painful sinuses", "cough", "nasal congestion", "headache", "fever", "sinus congestion", "coryza", "sore throat"], triage: "green", description: "Nose disorders include structural or inflammatory issues such as deviated septum, nasal polyps, or rhinitis, causing congestion, breathing difficulty, or nosebleeds.", overview: "Nose disorders include structural or inflammatory issues such as deviated septum, nasal polyps, or rhinitis, causing congestion, breathing difficulty, or nosebleeds. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under ENT, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "ENT" },
  { name: "Dental caries", symptoms: ["facial pain", "peripheral edema", "restlessness", "gum pain", "mouth pain", "ear pain", "toothache", "pain in gums", "jaw swelling", "neck swelling", "skin irritation", "skin swelling"], triage: "green", description: "Dental caries (tooth decay) is the destruction of tooth enamel due to acids produced by bacteria feeding on sugars, leading to cavities, tooth pain, and infection if untreated.", overview: "Dental caries (tooth decay) is the destruction of tooth enamel due to acids produced by bacteria feeding on sugars, leading to cavities, tooth pain, and infection if untreated. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dentistry, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dentistry" },
  { name: "Hypertensive heart disease", symptoms: ["leg swelling", "palpitations", "fatigue", "difficulty breathing", "chest tightness", "sharp chest pain", "recent pregnancy", "heartburn", "insomnia", "shortness of breath", "weakness"], triage: "red", description: "Hypertensive heart disease includes conditions caused by chronic high blood pressure, such as heart failure, thickened heart muscle, or coronary artery disease.", overview: "Hypertensive heart disease includes conditions caused by chronic high blood pressure, such as heart failure, thickened heart muscle, or coronary artery disease. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Cardiology, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Cardiology" },
  { name: "Seasonal allergies (hay fever)", symptoms: ["lacrimation", "ear pain", "frontal headache", "sneezing", "headache", "coryza", "allergic reaction", "nasal congestion", "cough", "itchiness of eye", "sore throat"], triage: "green", description: "Seasonal allergies, or hay fever, are allergic reactions to airborne allergens like pollen, causing sneezing, nasal congestion, itchy eyes, and throat irritation, often during specific seasons.", overview: "Seasonal allergies, or hay fever, are allergic reactions to airborne allergens like pollen, causing sneezing, nasal congestion, itchy eyes, and throat irritation, often during specific seasons. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Allergy & Immunology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Allergy & Immunology" },
  { name: "Fungal infection of the hair", symptoms: ["skin growth", "skin rash", "pelvic pain", "irregular appearing scalp", "skin lesion", "acne or pimples", "itching of skin", "itchy scalp", "abnormal appearing skin", "skin swelling", "skin irritation", "skin dryness, peeling, scaliness, or roughness"], triage: "green", description: "Fungal infection of the hair, or tinea capitis, is a scalp infection caused by dermatophyte fungi, resulting in scaly patches, hair loss, and sometimes black dots or swelling.", overview: "Fungal infection of the hair, or tinea capitis, is a scalp infection caused by dermatophyte fungi, resulting in scaly patches, hair loss, and sometimes black dots or swelling. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Rectal disorder", symptoms: ["heartburn", "pain of the anus", "constipation", "burning abdominal pain", "sharp abdominal pain", "rectal bleeding", "diarrhea", "cramps and spasms", "blood in stool", "melena", "itching of the anus"], triage: "yellow", description: "Rectal disorders include conditions affecting the rectum such as hemorrhoids, fissures, or prolapse, often causing pain, bleeding, or difficulty during bowel movements.", overview: "Rectal disorders include conditions affecting the rectum such as hemorrhoids, fissures, or prolapse, often causing pain, bleeding, or difficulty during bowel movements. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Colorectal Surgery, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Colorectal Surgery" },
  { name: "Stye", symptoms: ["skin swelling", "eyelid lesion or rash", "swollen eye", "mass on eyelid", "eyelid swelling", "symptoms of eye", "itchiness of eye", "pain in eye", "abnormal appearing skin", "eye burns or stings", "eye redness"], triage: "green", description: "A stye is a red, painful lump near the edge of the eyelid caused by a bacterial infection of an oil gland, often resolving on its own or with warm compresses.", overview: "A stye is a red, painful lump near the edge of the eyelid caused by a bacterial infection of an oil gland, often resolving on its own or with warm compresses. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Ophthalmology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Ophthalmology" },
  { name: "Heart attack", symptoms: ["heartburn", "fainting", "nausea", "increased heart rate", "burning chest pain", "sweating", "arm pain", "sharp chest pain", "shortness of breath", "irregular heartbeat", "chest tightness"], triage: "red", description: "A heart attack (myocardial infarction) occurs when blood flow to part of the heart is blocked, leading to chest pain, shortness of breath, nausea, and potentially life-threatening damage to heart muscle.", overview: "A heart attack (myocardial infarction) occurs when blood flow to part of the heart is blocked, leading to chest pain, shortness of breath, nausea, and potentially life-threatening damage to heart muscle. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Cardiology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Cardiology / Emergency" },
  { name: "Obstructive sleep apnea (OSA)", symptoms: ["mouth dryness", "fatigue", "sweating", "difficulty breathing", "abnormal breathing sounds", "abnormal involuntary movements", "apnea", "weight gain", "difficulty in swallowing", "insomnia", "sleepiness", "shortness of breath"], triage: "yellow", description: "OSA is a sleep disorder where the throat muscles intermittently relax and block the airway, causing repeated pauses in breathing during sleep and leading to poor rest and fatigue.", overview: "OSA is a sleep disorder where the throat muscles intermittently relax and block the airway, causing repeated pauses in breathing during sleep and leading to poor rest and fatigue. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pulmonology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pulmonology" },
  { name: "Psoriasis", symptoms: ["skin swelling", "skin rash", "irregular appearing scalp", "skin moles", "skin dryness, peeling, scaliness, or roughness", "skin growth", "itchy scalp", "itching of skin", "abnormal appearing skin", "joint pain", "skin lesion"], triage: "green", description: "Psoriasis is a chronic autoimmune skin condition causing rapid skin cell growth that results in thick, scaly, red patches, often on the elbows, knees, or scalp.", overview: "Psoriasis is a chronic autoimmune skin condition causing rapid skin cell growth that results in thick, scaly, red patches, often on the elbows, knees, or scalp. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Arthritis of the hip", symptoms: ["pelvic pain", "knee pain", "ache all over", "groin pain", "hip stiffness or tightness", "problems with movement", "hip pain", "back pain", "lower body pain", "low back pain", "joint pain", "leg pain"], triage: "yellow", description: "Arthritis of the hip involves inflammation and degeneration of the hip joint cartilage, leading to pain, stiffness, and reduced mobility, commonly due to osteoarthritis.", overview: "Arthritis of the hip involves inflammation and degeneration of the hip joint cartilage, leading to pain, stiffness, and reduced mobility, commonly due to osteoarthritis. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Sickle cell crisis", symptoms: ["vomiting", "arm pain", "leg pain", "sharp abdominal pain", "knee pain", "back pain", "burning abdominal pain", "ache all over", "sharp chest pain", "low back pain", "hip pain"], triage: "red", description: "Sickle cell crisis is a painful episode in people with sickle cell disease, where misshapen red blood cells block blood flow, causing severe pain, fatigue, and potential organ damage.", overview: "Sickle cell crisis is a painful episode in people with sickle cell disease, where misshapen red blood cells block blood flow, causing severe pain, fatigue, and potential organ damage. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Hematology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Hematology / Emergency" },
  { name: "Otitis externa (swimmer's ear)", symptoms: ["itchy ear(s)", "fever", "ear pain", "plugged feeling in ear", "redness in ear", "cough", "fluid in ear", "facial pain", "diminished hearing", "ringing in ear", "sore throat"], triage: "green", description: "Otitis externa is an infection of the outer ear canal, often due to trapped water and bacteria, leading to ear pain, itching, swelling, and discharge.", overview: "Otitis externa is an infection of the outer ear canal, often due to trapped water and bacteria, leading to ear pain, itching, swelling, and discharge. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under ENT, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "ENT" },
  { name: "Acute bronchiolitis", symptoms: ["nasal congestion", "fever", "wheezing", "vomiting", "hurts to breath", "cough", "decreased appetite", "difficulty breathing", "irritable infant", "pulling at ears", "shortness of breath", "coryza"], triage: "yellow", description: "Acute bronchiolitis is a common lower respiratory tract infection in infants, usually caused by RSV, leading to wheezing, coughing, and difficulty breathing.", overview: "Acute bronchiolitis is a common lower respiratory tract infection in infants, usually caused by RSV, leading to wheezing, coughing, and difficulty breathing. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pulmonology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pulmonology" },
  { name: "Pyogenic skin infection", symptoms: ["foot or toe pain", "abnormal appearing skin", "skin rash", "leg swelling", "hand or finger swelling", "peripheral edema", "leg pain", "foot or toe swelling", "skin lesion", "skin swelling", "hand or finger pain"], triage: "yellow", description: "A pyogenic skin infection is a bacterial infection of the skin that produces pus, such as abscesses, boils, or cellulitis, often caused by Staphylococcus aureus.", overview: "A pyogenic skin infection is a bacterial infection of the skin that produces pus, such as abscesses, boils, or cellulitis, often caused by Staphylococcus aureus. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Dermatology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Dermatology" },
  { name: "Noninfectious gastroenteritis", symptoms: ["diarrhea", "nausea", "sharp abdominal pain", "decreased appetite", "vomiting", "headache", "rectal bleeding", "burning abdominal pain", "chills", "fever", "fluid retention", "blood in stool"], triage: "yellow", description: "Noninfectious gastroenteritis refers to inflammation of the stomach and intestines not caused by infection, but by irritants like medications, alcohol, or food intolerances.", overview: "Noninfectious gastroenteritis refers to inflammation of the stomach and intestines not caused by infection, but by irritants like medications, alcohol, or food intolerances. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gastroenterology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gastroenterology" },
  { name: "Benign prostatic hyperplasia (BPH)", symptoms: ["symptoms of prostate", "frequent urination", "blood in urine", "impotence", "symptoms of bladder", "swelling of scrotum", "low urine output", "pain in testicles", "involuntary urination", "hesitancy", "retention of urine", "excessive urination at night"], triage: "yellow", description: "BPH is a non-cancerous enlargement of the prostate gland in older men, causing difficulty urinating, weak stream, or frequent urination, especially at night.", overview: "BPH is a non-cancerous enlargement of the prostate gland in older men, causing difficulty urinating, weak stream, or frequent urination, especially at night. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Urology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Urology" },
  { name: "Spinal stenosis", symptoms: ["back pain", "neck pain", "problems with movement", "arm pain", "lower body pain", "hip pain", "low back pain", "paresthesia", "headache", "loss of sensation", "leg pain", "shoulder pain"], triage: "yellow", description: "Spinal stenosis is the narrowing of the spinal canal, often due to arthritis or disc problems, leading to back pain, numbness, and weakness in the legs.", overview: "Spinal stenosis is the narrowing of the spinal canal, often due to arthritis or disc problems, leading to back pain, numbness, and weakness in the legs. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Acute bronchitis", symptoms: ["nasal congestion", "fever", "coryza", "cough", "headache", "sore throat", "sharp chest pain", "congestion in chest", "wheezing", "coughing up sputum", "difficulty breathing", "shortness of breath"], triage: "green", description: "Acute bronchitis is inflammation of the bronchial tubes in the lungs, typically caused by a viral infection, resulting in cough, mucus production, chest discomfort, and low-grade fever.", overview: "Acute bronchitis is inflammation of the bronchial tubes in the lungs, typically caused by a viral infection, resulting in cough, mucus production, chest discomfort, and low-grade fever. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Pulmonology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Pulmonology" },
  { name: "Croup", symptoms: ["nasal congestion", "vomiting", "cough", "abnormal breathing sounds", "hoarse voice", "fever", "pulling at ears", "wheezing", "sore throat", "shortness of breath", "coryza"], triage: "yellow", description: "Croup is a viral infection that causes swelling of the airway in young children, leading to a barking cough, hoarseness, and difficulty breathing, often worse at night.", overview: "Croup is a viral infection that causes swelling of the airway in young children, leading to a barking cough, hoarseness, and difficulty breathing, often worse at night. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Pediatrics / ENT, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Pediatrics / ENT" },
  { name: "Idiopathic excessive menstruation", symptoms: ["sharp abdominal pain", "frequent menstruation", "cramps and spasms", "painful menstruation", "unpredictable menstruation", "blood clots during menstrual periods", "long menstrual periods", "involuntary urination", "heavy menstrual flow", "intermenstrual bleeding", "vaginal discharge"], triage: "yellow", description: "Idiopathic excessive menstruation refers to abnormally heavy or prolonged menstrual bleeding without an identifiable underlying medical cause.", overview: "Idiopathic excessive menstruation refers to abnormally heavy or prolonged menstrual bleeding without an identifiable underlying medical cause. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gynecology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gynecology" },
  { name: "Ear drum damage", symptoms: ["pus draining from ear", "ringing in ear", "pulling at ears", "redness in ear", "ear pain", "plugged feeling in ear", "cough", "fluid in ear", "diminished hearing", "nasal congestion", "bleeding from ear"], triage: "yellow", description: "Ear drum damage (tympanic membrane perforation) is a tear or hole in the eardrum due to infection, injury, or loud noise, which may cause pain, hearing loss, or drainage.", overview: "Ear drum damage (tympanic membrane perforation) is a tear or hole in the eardrum due to infection, injury, or loud noise, which may cause pain, hearing loss, or drainage. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within ENT, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "ENT" },
  { name: "Temporary or benign blood in urine", symptoms: ["painful urination", "suprapubic pain", "frequent urination", "back pain", "involuntary urination", "blood in urine", "lower abdominal pain", "regurgitation", "sharp abdominal pain", "retention of urine", "symptoms of bladder"], triage: "yellow", description: "Temporary or benign hematuria is the presence of blood in the urine without a serious underlying cause, sometimes triggered by exercise, medications, or mild infections.", overview: "Temporary or benign hematuria is the presence of blood in the urine without a serious underlying cause, sometimes triggered by exercise, medications, or mild infections. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Urology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Urology" },
  { name: "Common cold", symptoms: ["chills", "ear pain", "headache", "cough", "fever", "vomiting", "flu-like syndrome", "wheezing", "coryza", "nasal congestion", "sore throat"], triage: "green", description: "The common cold is a viral infection of the upper respiratory tract, typically causing sneezing, sore throat, nasal congestion, cough, and mild fever.", overview: "The common cold is a viral infection of the upper respiratory tract, typically causing sneezing, sore throat, nasal congestion, cough, and mild fever. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under General Practice, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "General Practice" },
  { name: "Depression", symptoms: ["disturbance of memory", "abusing alcohol", "temper problems", "hostile behavior", "drug abuse", "delusions or hallucinations", "depression", "insomnia", "excessive anger", "depressive or psychotic symptoms", "anxiety and nervousness"], triage: "yellow", description: "Depression is a mental health disorder characterized by persistent sadness, loss of interest or pleasure, fatigue, and changes in sleep or appetite, significantly impacting daily life.", overview: "Depression is a mental health disorder characterized by persistent sadness, loss of interest or pleasure, fatigue, and changes in sleep or appetite, significantly impacting daily life. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Psychiatry, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Psychiatry" },
  { name: "Idiopathic irregular menstrual cycle", symptoms: ["cramps and spasms", "long menstrual periods", "heavy menstrual flow", "pelvic pain", "unpredictable menstruation", "sharp abdominal pain", "painful menstruation", "frequent menstruation", "lower abdominal pain", "intermenstrual bleeding", "infertility"], triage: "green", description: "Idiopathic irregular menstrual cycle refers to inconsistent or unpredictable menstrual periods without a clear medical cause, often linked to hormonal imbalance.", overview: "Idiopathic irregular menstrual cycle refers to inconsistent or unpredictable menstrual periods without a clear medical cause, often linked to hormonal imbalance. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gynecology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gynecology" },
  { name: "Schizophrenia", symptoms: ["insomnia", "hysterical behavior", "depression", "fears and phobias", "delusions or hallucinations", "low self-esteem", "depressive or psychotic symptoms", "excessive anger", "temper problems", "anxiety and nervousness", "hostile behavior"], triage: "red", description: "Schizophrenia is a severe psychiatric disorder involving distortions in thinking, perception, emotions, language, and behavior, often with hallucinations or delusions.", overview: "Schizophrenia is a severe psychiatric disorder involving distortions in thinking, perception, emotions, language, and behavior, often with hallucinations or delusions. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Psychiatry, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Psychiatry" },
  { name: "Sepsis", symptoms: ["shortness of breath", "fever", "feeling ill", "vomiting", "cough", "sharp abdominal pain", "weakness", "difficulty breathing", "suprapubic pain", "decreased appetite", "chills"], triage: "red", description: "Sepsis is a life-threatening response to infection where the body’s immune system causes widespread inflammation, leading to tissue damage, organ failure, and possibly death.", overview: "Sepsis is a life-threatening response to infection where the body’s immune system causes widespread inflammation, leading to tissue damage, organ failure, and possibly death. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Emergency / Infectious Disease, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Emergency / Infectious Disease" },
  { name: "Cholecystitis", symptoms: ["vomiting", "back pain", "side pain", "sharp abdominal pain", "burning abdominal pain", "regurgitation", "symptoms of the kidneys", "lower body pain", "nausea", "upper abdominal pain", "sharp chest pain", "stomach bloating"], triage: "red", description: "Cholecystitis is inflammation of the gallbladder, often due to gallstones, causing severe upper abdominal pain, fever, nausea, and tenderness.", overview: "Cholecystitis is inflammation of the gallbladder, often due to gallstones, causing severe upper abdominal pain, fever, nausea, and tenderness. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within General Surgery, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "General Surgery" },
  { name: "Cystitis", symptoms: ["involuntary urination", "side pain", "symptoms of bladder", "frequent urination", "suprapubic pain", "lower abdominal pain", "blood in urine", "sharp abdominal pain", "painful urination", "back pain", "retention of urine", "pelvic pain"], triage: "yellow", description: "Cystitis is inflammation of the bladder, usually from a bacterial infection, leading to frequent, painful urination and lower abdominal discomfort.", overview: "Cystitis is inflammation of the bladder, usually from a bacterial infection, leading to frequent, painful urination and lower abdominal discomfort. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Urology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Urology" },
  { name: "Hemorrhoids", symptoms: ["heartburn", "lower body pain", "rectal bleeding", "constipation", "changes in stool appearance", "itching of the anus", "mass or swelling around the anus", "pain of the anus", "melena", "blood in stool", "sharp abdominal pain"], triage: "green", description: "Hemorrhoids are swollen veins in the anus or rectum that cause pain, itching, bleeding, or discomfort during bowel movements.", overview: "Hemorrhoids are swollen veins in the anus or rectum that cause pain, itching, bleeding, or discomfort during bowel movements. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Colorectal Surgery, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Colorectal Surgery" },
  { name: "Contact dermatitis", symptoms: ["skin moles", "allergic reaction", "itching of skin", "skin irritation", "skin swelling", "skin dryness, peeling, scaliness, or roughness", "abnormal appearing skin", "skin lesion", "swollen eye", "skin rash", "acne or pimples"], triage: "green", description: "Contact dermatitis is a skin inflammation caused by exposure to an irritant or allergen, resulting in redness, itching, blisters, or dryness.", overview: "Contact dermatitis is a skin inflammation caused by exposure to an irritant or allergen, resulting in redness, itching, blisters, or dryness. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Sinus bradycardia", symptoms: ["chest tightness", "irregular heartbeat", "fainting", "decreased heart rate", "increased heart rate", "shortness of breath", "sharp chest pain", "dizziness", "palpitations", "feeling ill", "weakness"], triage: "yellow", description: "Sinus bradycardia is a slower than normal heart rate originating from the sinus node, which may be normal in athletes or caused by medications or medical conditions.", overview: "Sinus bradycardia is a slower than normal heart rate originating from the sinus node, which may be normal in athletes or caused by medications or medical conditions. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Cardiology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Cardiology" },
  { name: "Pelvic inflammatory disease", symptoms: ["burning abdominal pain", "vaginal discharge", "intermenstrual bleeding", "painful urination", "back pain", "nausea", "lower abdominal pain", "vomiting", "sharp abdominal pain", "pelvic pain", "suprapubic pain"], triage: "red", description: "Pelvic inflammatory disease (PID) is an infection of the female reproductive organs, often caused by sexually transmitted bacteria, leading to abdominal pain, fever, and abnormal discharge.", overview: "Pelvic inflammatory disease (PID) is an infection of the female reproductive organs, often caused by sexually transmitted bacteria, leading to abdominal pain, fever, and abnormal discharge. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Gynecology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Gynecology / Emergency" },
  { name: "Liver disease", symptoms: ["upper abdominal pain", "nausea", "blood in stool", "peripheral edema", "jaundice", "sharp abdominal pain", "unusual color or odor to urine", "side pain", "diarrhea", "weakness", "heartburn", "shortness of breath"], triage: "yellow", description: "Liver disease refers to a range of disorders affecting the liver, such as hepatitis, fatty liver, or cirrhosis, potentially causing jaundice, fatigue, and liver dysfunction.", overview: "Liver disease refers to a range of disorders affecting the liver, such as hepatitis, fatty liver, or cirrhosis, potentially causing jaundice, fatigue, and liver dysfunction. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Hepatology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Hepatology" },
  { name: "Chronic constipation", symptoms: ["retention of urine", "vomiting", "lower abdominal pain", "pain of the anus", "changes in stool appearance", "constipation", "blood in stool", "rectal bleeding", "sharp abdominal pain", "burning abdominal pain", "nausea"], triage: "green", description: "Chronic constipation is a long-term condition characterized by infrequent or difficult bowel movements, often accompanied by abdominal discomfort or bloating.", overview: "Chronic constipation is a long-term condition characterized by infrequent or difficult bowel movements, often accompanied by abdominal discomfort or bloating. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gastroenterology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gastroenterology" },
  { name: "Skin polyp", symptoms: ["skin swelling", "skin moles", "warts", "irregular appearing scalp", "acne or pimples", "abnormal appearing skin", "skin growth", "skin dryness, peeling, scaliness, or roughness", "skin irritation", "itching of skin", "skin lesion"], triage: "green", description: "A skin polyp (skin tag) is a small, benign growth of skin that typically appears in areas where skin rubs together, like the neck, armpits, or groin.", overview: "A skin polyp (skin tag) is a small, benign growth of skin that typically appears in areas where skin rubs together, like the neck, armpits, or groin. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Brachial neuritis", symptoms: ["elbow pain", "neck pain", "low back pain", "paresthesia", "back pain", "shoulder pain", "hand or finger pain", "hand or finger weakness", "arm pain", "loss of sensation", "headache"], triage: "yellow", description: "Brachial neuritis is inflammation of the brachial plexus nerves, causing sudden shoulder and arm pain followed by weakness or numbness.", overview: "Brachial neuritis is inflammation of the brachial plexus nerves, causing sudden shoulder and arm pain followed by weakness or numbness. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Neurology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Neurology" },
  { name: "Esophagitis", symptoms: ["difficulty in swallowing", "upper abdominal pain", "vomiting", "sore throat", "cough", "sharp chest pain", "nausea", "chest tightness", "heartburn", "sharp abdominal pain", "shortness of breath", "burning abdominal pain"], triage: "yellow", description: "Esophagitis is inflammation of the esophagus, commonly due to acid reflux, infections, or medications, causing pain when swallowing and chest discomfort.", overview: "Esophagitis is inflammation of the esophagus, commonly due to acid reflux, infections, or medications, causing pain when swallowing and chest discomfort. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gastroenterology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gastroenterology" },
  { name: "Diverticulitis", symptoms: ["constipation", "sharp abdominal pain", "lower abdominal pain", "nausea", "diarrhea", "vomiting", "chills", "side pain", "burning abdominal pain", "fever", "blood in stool", "upper abdominal pain"], triage: "red", description: "Diverticulitis is inflammation or infection of small pouches (diverticula) in the colon wall, leading to abdominal pain, fever, and changes in bowel habits.", overview: "Diverticulitis is inflammation or infection of small pouches (diverticula) in the colon wall, leading to abdominal pain, fever, and changes in bowel habits. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Gastroenterology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Gastroenterology / Emergency" },
  { name: "Sprain or strain", symptoms: ["back pain", "arm pain", "wrist pain", "foot or toe pain", "low back pain", "shoulder pain", "headache", "neck pain", "hand or finger pain", "ankle pain", "knee pain", "leg pain"], triage: "green", description: "A sprain is a stretched or torn ligament, while a strain is a stretched or torn muscle or tendon; both cause pain, swelling, and limited movement.", overview: "A sprain is a stretched or torn ligament, while a strain is a stretched or torn muscle or tendon; both cause pain, swelling, and limited movement. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Orthopedics, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Orthopedics" },
  { name: "Idiopathic painful menstruation", symptoms: ["vaginal discharge", "pelvic pain", "cramps and spasms", "heavy menstrual flow", "vaginal itching", "long menstrual periods", "blood clots during menstrual periods", "painful menstruation", "unpredictable menstruation", "sharp abdominal pain", "lower abdominal pain"], triage: "green", description: "Idiopathic painful menstruation (primary dysmenorrhea) is severe menstrual cramping without an identifiable medical condition, often starting in adolescence.", overview: "Idiopathic painful menstruation (primary dysmenorrhea) is severe menstrual cramping without an identifiable medical condition, often starting in adolescence. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Gynecology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Gynecology" },
  { name: "Eustachian tube dysfunction (ear disorder)", symptoms: ["sore throat", "abnormal breathing sounds", "ringing in ear", "ear pain", "diminished hearing", "allergic reaction", "swollen or red tonsils", "dizziness", "redness in ear", "plugged feeling in ear", "nasal congestion"], triage: "green", description: "Eustachian tube dysfunction occurs when the tube connecting the middle ear to the throat becomes blocked or fails to open, causing pressure, pain, or hearing issues.", overview: "Eustachian tube dysfunction occurs when the tube connecting the middle ear to the throat becomes blocked or fails to open, causing pressure, pain, or hearing issues. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under ENT, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "ENT" },
  { name: "Appendicitis", symptoms: ["decreased appetite", "burning abdominal pain", "lower abdominal pain", "vomiting", "nausea", "stomach bloating", "fever", "upper abdominal pain", "side pain", "diarrhea", "sharp abdominal pain"], triage: "red", description: "Appendicitis is inflammation of the appendix, usually requiring surgery, and causes sudden lower right abdominal pain, nausea, and fever.", overview: "Appendicitis is inflammation of the appendix, usually requiring surgery, and causes sudden lower right abdominal pain, nausea, and fever. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within General Surgery / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "General Surgery / Emergency" },
  { name: "Hyperemesis gravidarum", symptoms: ["vomiting blood", "burning abdominal pain", "pain during pregnancy", "nausea", "weakness", "headache", "sharp abdominal pain", "diarrhea", "dizziness", "problems during pregnancy", "vomiting"], triage: "yellow", description: "Hyperemesis gravidarum is a severe form of morning sickness in pregnancy, leading to persistent nausea, vomiting, dehydration, and weight loss.", overview: "Hyperemesis gravidarum is a severe form of morning sickness in pregnancy, leading to persistent nausea, vomiting, dehydration, and weight loss. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Obstetrics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Obstetrics" },
  { name: "Urinary tract infection", symptoms: ["suprapubic pain", "painful urination", "side pain", "blood in urine", "frequent urination", "back pain", "vomiting", "lower abdominal pain", "retention of urine", "nausea", "fever"], triage: "yellow", description: "A urinary tract infection (UTI) is an infection in any part of the urinary system, commonly the bladder, causing pain during urination, urgency, and cloudy or strong-smelling urine.", overview: "A urinary tract infection (UTI) is an infection in any part of the urinary system, commonly the bladder, causing pain during urination, urgency, and cloudy or strong-smelling urine. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Urology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Urology" },
  { name: "Peripheral nerve disorder", symptoms: ["leg weakness", "loss of sensation", "arm pain", "back pain", "foot or toe pain", "leg pain", "abnormal involuntary movements", "paresthesia", "arm weakness", "problems with movement", "disturbance of memory", "dizziness"], triage: "yellow", description: "Peripheral nerve disorders affect the nerves outside the brain and spinal cord, leading to numbness, weakness, pain, or coordination problems.", overview: "Peripheral nerve disorders affect the nerves outside the brain and spinal cord, leading to numbness, weakness, pain, or coordination problems. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Neurology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Neurology" },
  { name: "Sebaceous cyst", symptoms: ["skin moles", "skin growth", "hand or finger lump or mass", "neck mass", "irregular appearing scalp", "abnormal appearing skin", "back mass or lump", "acne or pimples", "arm lump or mass", "skin lesion", "skin swelling"], triage: "green", description: "A sebaceous cyst is a noncancerous bump beneath the skin, filled with oily material, often caused by blocked sebaceous glands.", overview: "A sebaceous cyst is a noncancerous bump beneath the skin, filled with oily material, often caused by blocked sebaceous glands. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Spontaneous abortion", symptoms: ["burning abdominal pain", "uterine contractions", "pain during pregnancy", "pelvic pain", "heavy menstrual flow", "intermenstrual bleeding", "lower abdominal pain", "spotting or bleeding during pregnancy", "problems during pregnancy", "cramps and spasms", "sharp abdominal pain", "blood clots during menstrual periods"], triage: "red", description: "Spontaneous abortion (miscarriage) is the loss of a pregnancy before 20 weeks, often due to genetic issues or unknown causes, and may involve bleeding and cramping.", overview: "Spontaneous abortion (miscarriage) is the loss of a pregnancy before 20 weeks, often due to genetic issues or unknown causes, and may involve bleeding and cramping. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Obstetrics / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Obstetrics / Emergency" },
  { name: "Gallstone", symptoms: ["regurgitation", "back pain", "burning abdominal pain", "upper abdominal pain", "nausea", "lower body pain", "side pain", "heartburn", "sharp abdominal pain", "sharp chest pain", "vomiting"], triage: "yellow", description: "Gallstones are hardened deposits of digestive fluid in the gallbladder that can block bile flow, causing abdominal pain, nausea, and sometimes infection.", overview: "Gallstones are hardened deposits of digestive fluid in the gallbladder that can block bile flow, causing abdominal pain, nausea, and sometimes infection. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Gastroenterology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Gastroenterology" },
  { name: "Multiple sclerosis", symptoms: ["abnormal involuntary movements", "leg weakness", "loss of sensation", "fatigue", "problems with movement", "weakness", "disturbance of memory", "paresthesia", "headache", "focal weakness", "dizziness"], triage: "yellow", description: "Multiple sclerosis (MS) is an autoimmune disease where the immune system attacks the protective sheath of nerves, leading to weakness, vision problems, and coordination issues.", overview: "Multiple sclerosis (MS) is an autoimmune disease where the immune system attacks the protective sheath of nerves, leading to weakness, vision problems, and coordination issues. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Neurology, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Neurology" },
  { name: "Angina", symptoms: ["hot flashes", "palpitations", "sharp chest pain", "lower body pain", "chest tightness", "arm pain", "irregular heartbeat", "increased heart rate", "sweating", "dizziness", "shortness of breath"], triage: "red", description: "Angina is chest pain or discomfort due to reduced blood flow to the heart muscle, often triggered by exertion or stress, and relieved by rest or medication.", overview: "Angina is chest pain or discomfort due to reduced blood flow to the heart muscle, often triggered by exertion or stress, and relieved by rest or medication. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Cardiology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Cardiology / Emergency" },
  { name: "Skin pigmentation disorder", symptoms: ["irregular appearing scalp", "warts", "skin growth", "skin moles", "skin dryness, peeling, scaliness, or roughness", "skin swelling", "acne or pimples", "itching of skin", "abnormal appearing skin", "skin rash", "skin lesion"], triage: "green", description: "Skin pigmentation disorders involve changes in skin color due to excess or lack of melanin, such as vitiligo, melasma, or hyperpigmentation.", overview: "Skin pigmentation disorders involve changes in skin color due to excess or lack of melanin, such as vitiligo, melasma, or hyperpigmentation. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
  { name: "Personality disorder", symptoms: ["temper problems", "hostile behavior", "delusions or hallucinations", "insomnia", "low self-esteem", "depression", "excessive anger", "fears and phobias", "anxiety and nervousness", "drug abuse", "depressive or psychotic symptoms"], triage: "yellow", description: "Personality disorders are mental health conditions involving rigid and unhealthy patterns of thinking, functioning, and behaving that impair social or occupational life.", overview: "Personality disorders are mental health conditions involving rigid and unhealthy patterns of thinking, functioning, and behaving that impair social or occupational life. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Psychiatry, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Psychiatry" },
  { name: "Strep throat", symptoms: ["vomiting", "headache", "ear pain", "skin rash", "decreased appetite", "chills", "nasal congestion", "ache all over", "cough", "fever", "sore throat", "difficulty in swallowing"], triage: "yellow", description: "Strep throat is a bacterial throat infection caused by Streptococcus pyogenes, leading to sore throat, fever, swollen glands, and red tonsils with white patches.", overview: "Strep throat is a bacterial throat infection caused by Streptococcus pyogenes, leading to sore throat, fever, swollen glands, and red tonsils with white patches. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within ENT / Infectious Disease, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "ENT / Infectious Disease" },
  { name: "Developmental disability", symptoms: ["restlessness", "obsessions and compulsions", "hostile behavior", "temper problems", "fears and phobias", "delusions or hallucinations", "seizures", "difficulty speaking", "antisocial behavior", "lack of growth", "depressive or psychotic symptoms"], triage: "yellow", description: "Developmental disabilities are chronic conditions that begin in childhood and affect physical, learning, language, or behavioral areas, such as autism or intellectual disability.", overview: "Developmental disabilities are chronic conditions that begin in childhood and affect physical, learning, language, or behavioral areas, such as autism or intellectual disability. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Developmental Pediatrics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Developmental Pediatrics" },
  { name: "Chronic back pain", symptoms: ["back cramps or spasms", "side pain", "low back pain", "hip pain", "back pain", "back stiffness or tightness", "neck pain", "lower body pain", "groin pain", "leg pain", "loss of sensation"], triage: "green", description: "Chronic back pain is persistent or recurring pain in the back lasting more than three months, often due to structural issues, nerve damage, or degenerative conditions.", overview: "Chronic back pain is persistent or recurring pain in the back lasting more than three months, often due to structural issues, nerve damage, or degenerative conditions. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Orthopedics, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Orthopedics" },
  { name: "Heart failure", symptoms: ["cough", "palpitations", "sharp chest pain", "difficulty breathing", "hurts to breath", "leg swelling", "weight gain", "fluid retention", "shortness of breath", "chest tightness", "weakness"], triage: "red", description: "Heart failure is a condition where the heart can't pump blood effectively, leading to fatigue, shortness of breath, fluid retention, and reduced exercise capacity.", overview: "Heart failure is a condition where the heart can't pump blood effectively, leading to fatigue, shortness of breath, fluid retention, and reduced exercise capacity. This condition can escalate quickly and, in some presentations, become life-threatening, so it should never be managed with home care alone — prompt medical evaluation is important even if symptoms seem manageable at first. It's typically handled within Cardiology / Emergency, often urgently, since the underlying cause and the right intervention need to be identified quickly. The tabs below are meant as general background reading only — they are not a substitute for the urgent medical attention this condition calls for.", department: "Cardiology / Emergency" },
  { name: "Conjunctivitis", symptoms: ["sore throat", "pain in eye", "coryza", "swollen eye", "cough", "eye redness", "itchiness of eye", "fever", "white discharge from eye", "nasal congestion", "lacrimation"], triage: "green", description: "Conjunctivitis (pink eye) is inflammation of the conjunctiva of the eye due to infection or allergy, resulting in redness, discharge, and eye irritation.", overview: "Conjunctivitis (pink eye) is inflammation of the conjunctiva of the eye due to infection or allergy, resulting in redness, discharge, and eye irritation. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Ophthalmology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Ophthalmology" },
  { name: "Herniated disk", symptoms: ["arm pain", "low back pain", "paresthesia", "back pain", "neck pain", "hip pain", "leg pain", "shoulder pain", "loss of sensation", "leg weakness", "arm weakness"], triage: "yellow", description: "A herniated disk occurs when the inner gel-like core of a spinal disc bulges out through a tear, pressing on nearby nerves and causing back pain, numbness, or weakness.", overview: "A herniated disk occurs when the inner gel-like core of a spinal disc bulges out through a tear, pressing on nearby nerves and causing back pain, numbness, or weakness. Severity varies from person to person, and while many cases can be managed with the right care routine, a clinician's evaluation is usually needed to confirm the diagnosis, rule out complications, and guide treatment. It's typically evaluated and managed within Orthopedics, and the right treatment plan depends on severity, medical history, and how symptoms respond over the first few days. The Precautions, Diet, Activity, and Medication tabs below cover general guidance that's typically recommended alongside a doctor's care — not a replacement for it.", department: "Orthopedics" },
  { name: "Diaper rash", symptoms: ["temper problems", "skin rash", "diaper rash", "nasal congestion", "diarrhea", "fever", "pulling at ears", "vomiting", "blood in stool", "cough", "irritable infant"], triage: "green", description: "Diaper rash is skin irritation in the diaper area of infants or adults using diapers, often caused by moisture, friction, or infection.", overview: "Diaper rash is skin irritation in the diaper area of infants or adults using diapers, often caused by moisture, friction, or infection. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Pediatrics / Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Pediatrics / Dermatology" },
  { name: "Eczema", symptoms: ["itching of skin", "skin lesion", "acne or pimples", "skin swelling", "skin rash", "warts", "irregular appearing scalp", "skin irritation", "allergic reaction", "abnormal appearing skin", "skin dryness, peeling, scaliness, or roughness", "cough"], triage: "green", description: "Eczema (atopic dermatitis) is a chronic skin condition that causes itchy, inflamed, red, and dry skin, often triggered by allergens, stress, or irritants.", overview: "Eczema (atopic dermatitis) is a chronic skin condition that causes itchy, inflamed, red, and dry skin, often triggered by allergens, stress, or irritants. This is generally a mild, self-limited condition that most people can manage at home, though it can occasionally take a week or two to fully settle or flare up again if the underlying trigger isn't addressed. It falls under Dermatology, and the specific triggers and recovery timeline vary from person to person. The Precautions, Diet, Activity, and Medication tabs below outline the self-care steps most people find helpful for a smoother, faster recovery.", department: "Dermatology" },
];

const PRECAUTIONS_DB = {
  "Actinic keratosis": ["Avoid sun exposure — since UV exposure is a major driver of the underlying skin changes.", "Use broad-spectrum sunscreen — since UV exposure is a major driver of the underlying skin changes.", "Wear protective clothing — since UV exposure is a major driver of the underlying skin changes.", "See dermatologist regularly — so treatment can be adjusted based on how you're responding."],
  "Acute bronchiolitis": ["Keep child hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Use humidifier — to loosen and clear secretions without irritating the airway.", "Avoid exposure to smoke — since irritants and pressure changes can aggravate inflamed airways further.", "Monitor breathing — so any worsening can be caught early and addressed quickly."],
  "Acute bronchitis": ["Avoid smoking — since smoke irritates and further inflames already-sensitive tissue.", "Drink warm fluids — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Use cough suppressants if needed — to ease breathing and reduce the urge to cough while the airway heals.", "Rest and recover — to give the body's natural repair processes time to work without added strain."],
  "Acute bronchospasm": ["Avoid cold air — since cold air can trigger constriction and worsen symptoms.", "Use bronchodilator inhaler — to ease breathing and reduce the urge to cough while the airway heals.", "Avoid allergens — to prevent a flare-up before it starts.", "Monitor breathing patterns — so any worsening can be caught early and addressed quickly."],
  "Acute kidney injury": ["Avoid NSAIDs — as these can worsen kidney strain, stomach irritation, or bleeding risk depending on the condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Monitor fluid intake — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Follow renal diet plan — to reduce the workload on the affected organ and limit symptom flare-ups."],
  "Acute pancreatitis": ["Avoid alcohol — since alcohol can worsen inflammation, interact with medications, and slow healing.", "Eat a low-fat diet — to reduce the workload on the affected organ and limit symptom flare-ups.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Follow doctor's advice strictly — so care stays consistent and adjustments happen before problems escalate."],
  "Acute sinusitis": ["Use nasal saline spray — to loosen and clear secretions without irritating the airway.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid allergens — to prevent a flare-up before it starts.", "Use warm compresses — to loosen congestion and improve comfort."],
  "Allergy": ["Apply calamine — to protect the area and reduce itching or irritation while it heals.", "Cover area with bandage — to protect the area and reduce itching or irritation while it heals.", "Use ice to compress itching — to reduce swelling and numb discomfort in the early stages.", "Avoid known allergens — to prevent a flare-up before it starts."],
  "Angina": ["Avoid overexertion — to prevent re-injury while the area heals.", "Take nitroglycerin as prescribed — since timely use can relieve chest pain quickly during an episode.", "Manage stress — since stress and physical symptoms often reinforce each other.", "Avoid cold exposure — since cold air can trigger constriction and worsen symptoms."],
  "Anxiety": ["Practice relaxation techniques — since stress and physical symptoms often reinforce each other.", "Avoid stimulants like caffeine — as part of a safe, steady recovery routine for this condition.", "Maintain regular sleep — since poor sleep can worsen both mood and physical symptoms.", "Seek counseling if needed — since stress and physical symptoms often reinforce each other."],
  "Appendicitis": ["Avoid taking laxatives — since these can mask or worsen the underlying issue if used incorrectly.", "Seek emergency care — since prompt professional care is essential for a safe outcome.", "Don’t eat or drink before surgery — since prompt professional care is essential for a safe outcome.", "Follow post-op instructions — since prompt professional care is essential for a safe outcome."],
  "Arthritis of the hip": ["Do low-impact exercises — to strengthen supporting muscles without adding strain to the affected joint or spine.", "Use walking aids if needed — to reduce mechanical strain on the affected area during daily activity.", "Maintain healthy weight — since extra weight adds mechanical or metabolic strain on the affected system.", "Take anti-inflammatory medication — exactly as directed, since stopping early or skipping doses can let symptoms rebound."],
  "Asthma": ["Avoid known triggers — to prevent a flare-up before it starts.", "Use inhaler as prescribed — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Monitor peak flow — so any drop in lung function is caught before it becomes an emergency.", "Keep emergency inhaler handy — since prompt professional care is essential for a safe outcome."],
  "Benign prostatic hyperplasia (BPH)": ["Limit evening fluid intake — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid alcohol and caffeine — since alcohol can worsen inflammation, interact with medications, and slow healing.", "Empty bladder completely — to reduce nighttime symptoms and bladder strain.", "Follow up with urologist — so treatment can be adjusted based on how you're responding."],
  "Brachial neuritis": ["Avoid heavy lifting — to prevent re-injury while the area heals.", "Physical therapy — to gradually rebuild strength, flexibility, and range of motion.", "Manage pain with meds — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Get adequate rest — to give the body's natural repair processes time to work without added strain."],
  "Bursitis": ["Rest the affected joint — to give the body's natural repair processes time to work without added strain.", "Apply ice packs — to reduce swelling and numb discomfort in the early stages.", "Use joint support — to reduce mechanical strain on the affected area during daily activity.", "Avoid repetitive strain — to prevent re-injury while the area heals."],
  "Carpal tunnel syndrome": ["Take frequent hand breaks — to give strained muscles and nerves time to recover during the day.", "Use wrist splints — to reduce mechanical strain on the affected area during daily activity.", "Avoid repetitive motions — to prevent re-injury while the area heals.", "Do stretching exercises — to gradually rebuild strength, flexibility, and range of motion."],
  "Cholecystitis": ["Avoid fatty foods — to reduce the workload on the affected organ and limit symptom flare-ups.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Follow up for imaging/tests — so treatment can be adjusted based on how you're responding.", "Take antibiotics as prescribed — but only when a bacterial cause is confirmed by a clinician."],
  "Chronic back pain": ["Maintain proper posture — to reduce mechanical strain on the affected area during daily activity.", "Regular stretching — to gradually rebuild strength, flexibility, and range of motion.", "Use ergonomic furniture — to reduce mechanical strain on the affected area during daily activity.", "Avoid lifting heavy objects — to prevent re-injury while the area heals."],
  "Chronic constipation": ["Increase fiber intake — since regular, unhurried bowel habits reduce straining and irritation.", "Exercise regularly — since regular movement supports circulation, mood, and long-term symptom control.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid delaying bowel movements — since regular, unhurried bowel habits reduce straining and irritation."],
  "Chronic obstructive pulmonary disease (COPD)": ["Avoid smoking — since smoke irritates and further inflames already-sensitive tissue.", "Use inhalers as prescribed — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Stay away from air pollution — since irritants and pressure changes can aggravate inflamed airways further.", "Get vaccinated against flu — to lower the risk of infections that could worsen this condition."],
  "Common cold": ["Drink plenty of fluids — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Rest well — to give the body's natural repair processes time to work without added strain.", "Use nasal decongestants — to ease breathing and reduce the urge to cough while the airway heals.", "Practice good hygiene — to reduce the chance of re-infection or spreading it to others."],
  "Complex regional pain syndrome": ["Follow physical therapy — to gradually rebuild strength, flexibility, and range of motion.", "Manage stress — since stress and physical symptoms often reinforce each other.", "Take prescribed medication — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Avoid injury to the affected limb — to avoid aggravating the area before it's fully healed."],
  "Concussion": ["Rest and avoid screens — to give the body's natural repair processes time to work without added strain.", "Avoid physical activity — to avoid aggravating the area before it's fully healed.", "Monitor symptoms — so any worsening can be caught early and addressed quickly.", "Follow up with neurologist — so treatment can be adjusted based on how you're responding."],
  "Conjunctivitis": ["Use prescribed eye drops — to target the irritation directly and speed up healing.", "Avoid touching/rubbing eyes — since friction or contamination can worsen irritation or spread infection.", "Wash hands frequently — to reduce the chance of re-infection or spreading it to others.", "Don’t share towels — to avoid re-exposure or spreading the irritant or infection."],
  "Conjunctivitis due to allergy": ["Avoid rubbing eyes — since friction or contamination can worsen irritation or spread infection.", "Use antihistamine drops — to target the irritation directly and speed up healing.", "Keep environment clean — to reduce the chance of reinfection or further irritation.", "Avoid known allergens — to prevent a flare-up before it starts."],
  "Contact dermatitis": ["Identify and avoid allergen — to prevent a flare-up before it starts.", "Use fragrance-free products — since fragrances and dyes are common irritants that can trigger flare-ups.", "Apply soothing lotion — to protect the area and reduce itching or irritation while it heals.", "Wear gloves when needed — to avoid re-exposure or spreading the irritant or infection."],
  "Cornea infection": ["Avoid touching eyes — since friction or contamination can worsen irritation or spread infection.", "Use prescribed eye drops — to target the irritation directly and speed up healing.", "Wear sunglasses — to avoid re-exposure or spreading the irritant or infection.", "Don’t share towels or cosmetics — to avoid re-exposure or spreading the irritant or infection."],
  "Croup": ["Use humidified air — to ease breathing and prevent unnecessary distress that can worsen symptoms.", "Keep child calm — to ease breathing and prevent unnecessary distress that can worsen symptoms.", "Encourage fluid intake — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Seek medical help for breathing difficulty — so any drop in lung function is caught before it becomes an emergency."],
  "Cystitis": ["Drink cranberry juice or water — which helps flush bacteria from the urinary tract.", "Urinate frequently — which helps flush bacteria from the urinary tract.", "Avoid irritants like caffeine — since stimulants can heighten physical symptoms.", "Wipe front to back — to prevent bacteria from the bowel reaching the urinary or genital area."],
  "Degenerative disc disease": ["Maintain healthy weight — since extra weight adds mechanical or metabolic strain on the affected system.", "Avoid lifting heavy items — to prevent re-injury while the area heals.", "Engage in back exercises — to strengthen supporting muscles without adding strain to the affected joint or spine.", "Use lumbar support — to strengthen supporting muscles without adding strain to the affected joint or spine."],
  "Dental caries": ["Brush twice daily — since consistent oral hygiene is the main defense against this condition progressing.", "Limit sugar intake — since excess sugar can worsen inflammation and feed some infections.", "Visit dentist regularly — since consistent oral hygiene is the main defense against this condition progressing.", "Floss daily — since consistent oral hygiene is the main defense against this condition progressing."],
  "Depression": ["Maintain social connection — since consistent routines and support networks are a core part of managing this condition.", "Follow treatment plan — so care stays consistent and adjustments happen before problems escalate.", "Get regular exercise — since regular movement supports circulation, mood, and long-term symptom control.", "Avoid alcohol and drugs — since alcohol can worsen inflammation, interact with medications, and slow healing."],
  "Developmental disability": ["Follow individualized education plans — since consistent routines and support networks are a core part of managing this condition.", "Encourage structured routine — since consistent routines and support networks are a core part of managing this condition.", "Regular therapy — since consistent routines and support networks are a core part of managing this condition.", "Provide positive reinforcement — since encouragement and consistency support better long-term outcomes."],
  "Diaper rash": ["Keep area dry — to reduce the chance of reinfection or further irritation.", "Change diapers frequently — since prolonged moisture and contact are the main triggers for this irritation.", "Apply protective creams — which shields the skin from moisture and friction.", "Avoid scented products — since fragrances and dyes are common irritants that can trigger flare-ups."],
  "Diverticulitis": ["Eat low-fiber during flare-ups — since these can irritate the digestive tract during a flare-up.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Take antibiotics if prescribed — but only when a bacterial cause is confirmed by a clinician.", "Avoid seeds/nuts if advised — since these can irritate the digestive tract during a flare-up."],
  "Drug reaction": ["Stop the drug immediately — since continuing it could trigger a more severe reaction.", "Consult a doctor — so treatment can be adjusted based on how you're responding.", "Use antihistamines if prescribed — as part of a safe, steady recovery routine for this condition.", "Monitor for worsening symptoms — so care can be escalated quickly if the condition doesn't improve as expected."],
  "Ear drum damage": ["Avoid water entry into ear — since keeping the ear canal dry and undisturbed is key to healing.", "Don’t insert objects into ear — since keeping the ear canal dry and undisturbed is key to healing.", "Use ear drops as prescribed — since keeping the ear canal dry and undisturbed is key to healing.", "Follow up with ENT — so treatment can be adjusted based on how you're responding."],
  "Eczema": ["Moisturize regularly — to protect the area and reduce itching or irritation while it heals.", "Avoid irritants like soaps & wool — as part of a safe, steady recovery routine for this condition.", "Use corticosteroid creams — to calm inflammation directly at the site.", "Reduce stress — since stress hormones can worsen physical symptoms and slow recovery."],
  "Esophagitis": ["Avoid spicy & acidic food — to reduce the workload on the affected organ and limit symptom flare-ups.", "Eat smaller meals — since this reduces pressure on the stomach and lowers reflux risk.", "Sit upright after eating — since this reduces pressure on the stomach and lowers reflux risk.", "Follow prescribed medication — exactly as directed for the treatment to work as intended."],
  "Eustachian tube dysfunction (ear disorder)": ["Avoid flying with a cold — since irritants and pressure changes can aggravate inflamed airways further.", "Use decongestants — to ease breathing and reduce the urge to cough while the airway heals.", "Perform Valsalva maneuver — which helps equalize pressure and relieve discomfort in the ear.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes."],
  "Fungal infection of the hair": ["Keep scalp dry and clean — to reduce the chance of reinfection or further irritation.", "Avoid sharing personal items — as part of a safe, steady recovery routine for this condition.", "Use antifungal shampoo — which directly targets the fungus causing the irritation.", "Maintain proper hygiene — to reduce the chance of reinfection or further irritation."],
  "Gallstone": ["Avoid high-fat foods — since excess weight and fat intake add strain on the affected system.", "Maintain a healthy weight — since excess weight and fat intake add strain on the affected system.", "Eat regular meals — as part of a safe, steady recovery routine for this condition.", "Follow up for surgical evaluation if needed — so treatment can be adjusted based on how you're responding."],
  "Gastrointestinal hemorrhage": ["Avoid NSAIDs — as these can worsen kidney strain, stomach irritation, or bleeding risk depending on the condition.", "Eat a soft bland diet — as part of a safe, steady recovery routine for this condition.", "Limit alcohol — as part of a safe, steady recovery routine for this condition.", "Follow up with GI specialist — so treatment can be adjusted based on how you're responding."],
  "Gout": ["Avoid purine-rich food — as part of a safe, steady recovery routine for this condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Limit alcohol intake — as part of a safe, steady recovery routine for this condition.", "Take medication as prescribed — as part of a safe, steady recovery routine for this condition."],
  "Gum disease": ["Maintain oral hygiene — as part of a safe, steady recovery routine for this condition.", "Floss daily — since consistent oral hygiene is the main defense against this condition progressing.", "Avoid smoking — since smoke irritates and further inflames already-sensitive tissue.", "Visit dentist regularly — since consistent oral hygiene is the main defense against this condition progressing."],
  "Heart attack": ["Take prescribed medication — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Avoid stress — since stress hormones can worsen physical symptoms and slow recovery.", "Eat heart-healthy diet — as part of a safe, steady recovery routine for this condition.", "Monitor cholesterol and BP — as part of a safe, steady recovery routine for this condition."],
  "Heart failure": ["Monitor fluid intake — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Follow low-sodium diet — to reduce the workload on the affected organ and limit symptom flare-ups.", "Take prescribed meds — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Track weight daily — as part of a safe, steady recovery routine for this condition."],
  "Hemorrhoids": ["Eat fiber-rich foods — as part of a safe, steady recovery routine for this condition.", "Avoid prolonged sitting — as part of a safe, steady recovery routine for this condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Use sitz baths — which soothes the area and promotes healing with warm, clean water."],
  "Herniated disk": ["Avoid lifting heavy items — to prevent re-injury while the area heals.", "Follow physical therapy — to gradually rebuild strength, flexibility, and range of motion.", "Use proper posture — to reduce mechanical strain on the affected area during daily activity.", "Take prescribed meds — exactly as directed, since stopping early or skipping doses can let symptoms rebound."],
  "Hiatal hernia": ["Eat small frequent meals — which is easier on the digestive system than large meals.", "Avoid lying down after eating — as part of a safe, steady recovery routine for this condition.", "Avoid spicy food — to reduce the workload on the affected organ and limit symptom flare-ups.", "Maintain healthy weight — since extra weight adds mechanical or metabolic strain on the affected system."],
  "Hyperemesis gravidarum": ["Eat small, frequent meals — as part of a safe, steady recovery routine for this condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid strong odors — as part of a safe, steady recovery routine for this condition.", "Take prescribed anti-nausea meds — as part of a safe, steady recovery routine for this condition."],
  "Hypertensive heart disease": ["Reduce salt intake — as part of a safe, steady recovery routine for this condition.", "Monitor blood pressure — as part of a safe, steady recovery routine for this condition.", "Exercise regularly — since regular movement supports circulation, mood, and long-term symptom control.", "Take antihypertensive medication — as part of a safe, steady recovery routine for this condition."],
  "Hypoglycemia": ["Eat small frequent meals — which is easier on the digestive system than large meals.", "Carry glucose tablets — as part of a safe, steady recovery routine for this condition.", "Avoid skipping meals — as part of a safe, steady recovery routine for this condition.", "Monitor blood sugar levels — as part of a safe, steady recovery routine for this condition."],
  "Idiopathic excessive menstruation": ["Use sanitary protection — as part of a safe, steady recovery routine for this condition.", "Monitor blood loss — as part of a safe, steady recovery routine for this condition.", "Iron-rich diet — as part of a safe, steady recovery routine for this condition.", "Consult gynecologist — so treatment can be adjusted based on how you're responding."],
  "Idiopathic irregular menstrual cycle": ["Keep menstrual diary — as part of a safe, steady recovery routine for this condition.", "Maintain healthy weight — since extra weight adds mechanical or metabolic strain on the affected system.", "Reduce stress — since stress hormones can worsen physical symptoms and slow recovery.", "Consult a gynecologist — so treatment can be adjusted based on how you're responding."],
  "Idiopathic painful menstruation": ["Use heat pads — as part of a safe, steady recovery routine for this condition.", "Take antispasmodics/NSAIDs — as part of a safe, steady recovery routine for this condition.", "Regular exercise — as part of a safe, steady recovery routine for this condition.", "Avoid stress — since stress hormones can worsen physical symptoms and slow recovery."],
  "Infectious gastroenteritis": ["Wash hands frequently — to reduce the chance of re-infection or spreading it to others.", "Avoid sharing utensils — to avoid spreading the infection to others or reinfecting yourself.", "Drink clean water — as part of a safe, steady recovery routine for this condition.", "Avoid street food — as part of a safe, steady recovery routine for this condition."],
  "Injury to the arm": ["Immobilize the arm — as part of a safe, steady recovery routine for this condition.", "Apply cold compress — to reduce swelling and numb discomfort in the early stages.", "Elevate the arm — to reduce swelling and support circulation while healing.", "Seek medical care if swelling — as part of a safe, steady recovery routine for this condition."],
  "Injury to the leg": ["Elevate the leg — to reduce swelling and support circulation while healing.", "Apply ice packs — to reduce swelling and numb discomfort in the early stages.", "Avoid putting weight — as part of a safe, steady recovery routine for this condition.", "Use crutches if advised — as part of a safe, steady recovery routine for this condition."],
  "Injury to the trunk": ["Apply ice or heat — as part of a safe, steady recovery routine for this condition.", "Rest adequately — to give the body's natural repair processes time to work without added strain.", "Use support belts if advised — as part of a safe, steady recovery routine for this condition.", "Avoid strenuous activity — to avoid aggravating the area before it's fully healed."],
  "Liver disease": ["Avoid alcohol — since alcohol can worsen inflammation, interact with medications, and slow healing.", "Follow a liver-friendly diet — as part of a safe, steady recovery routine for this condition.", "Get vaccinated for hepatitis — to lower the risk of infections that could worsen this condition.", "Monitor liver function tests — as part of a safe, steady recovery routine for this condition."],
  "Macular degeneration": ["Wear sunglasses — to avoid re-exposure or spreading the irritant or infection.", "Eat leafy greens — as part of a safe, steady recovery routine for this condition.", "Avoid smoking — since smoke irritates and further inflames already-sensitive tissue.", "Regular eye checkups — as part of a safe, steady recovery routine for this condition."],
  "Marijuana abuse": ["Avoid peer pressure — as part of a safe, steady recovery routine for this condition.", "Seek counseling — since stress and physical symptoms often reinforce each other.", "Build healthy habits — as part of a safe, steady recovery routine for this condition.", "Avoid triggering environments — as part of a safe, steady recovery routine for this condition."],
  "Multiple sclerosis": ["Avoid overheating — as part of a safe, steady recovery routine for this condition.", "Follow medication schedule — as part of a safe, steady recovery routine for this condition.", "Stay physically active — as part of a safe, steady recovery routine for this condition.", "Rest when needed — to give the body's natural repair processes time to work without added strain."],
  "Noninfectious gastroenteritis": ["Avoid irritant foods — as part of a safe, steady recovery routine for this condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Eat bland diet — as part of a safe, steady recovery routine for this condition.", "Rest well — to give the body's natural repair processes time to work without added strain."],
  "Nose disorder": ["Avoid nose picking — as part of a safe, steady recovery routine for this condition.", "Keep nasal passages moist — as part of a safe, steady recovery routine for this condition.", "Use saline sprays — to loosen and clear secretions without irritating the airway.", "Avoid irritants and allergens — as part of a safe, steady recovery routine for this condition."],
  "Obstructive sleep apnea (OSA)": ["Maintain healthy weight — since extra weight adds mechanical or metabolic strain on the affected system.", "Use CPAP machine if prescribed — as part of a safe, steady recovery routine for this condition.", "Avoid alcohol before bedtime — since alcohol can worsen inflammation, interact with medications, and slow healing.", "Sleep on your side — as part of a safe, steady recovery routine for this condition."],
  "Otitis externa (swimmer's ear)": ["Dry ears after swimming — as part of a safe, steady recovery routine for this condition.", "Avoid inserting objects into ears — as part of a safe, steady recovery routine for this condition.", "Use prescribed ear drops — as part of a safe, steady recovery routine for this condition.", "Avoid dirty water bodies — as part of a safe, steady recovery routine for this condition."],
  "Otitis media": ["Avoid water entering ears — as part of a safe, steady recovery routine for this condition.", "Take antibiotics as prescribed — but only when a bacterial cause is confirmed by a clinician.", "Use warm compress — to loosen congestion and improve comfort.", "Follow up with ENT specialist — so treatment can be adjusted based on how you're responding."],
  "Pain after an operation": ["Take pain meds as prescribed — as part of a safe, steady recovery routine for this condition.", "Avoid physical strain — as part of a safe, steady recovery routine for this condition.", "Keep surgical area clean — as part of a safe, steady recovery routine for this condition.", "Attend follow-up appointments — so treatment can be adjusted based on how you're responding."],
  "Panic disorder": ["Practice deep breathing — as part of a safe, steady recovery routine for this condition.", "Avoid caffeine — since caffeine can heighten symptoms like anxiety, palpitations, or irritation.", "Follow therapy plan — since consistent routines and support networks are a core part of managing this condition.", "Seek support from loved ones — as part of a safe, steady recovery routine for this condition."],
  "Pelvic inflammatory disease": ["Complete full course of antibiotics — but only when a bacterial cause is confirmed by a clinician.", "Avoid sexual activity during treatment — as part of a safe, steady recovery routine for this condition.", "Practice safe sex — as part of a safe, steady recovery routine for this condition.", "Attend follow-up appointments — so treatment can be adjusted based on how you're responding."],
  "Peripheral nerve disorder": ["Avoid repetitive injury — to prevent re-injury while the area heals.", "Use ergonomic tools — to reduce mechanical strain on the affected area during daily activity.", "Take B vitamins if deficient — as part of a safe, steady recovery routine for this condition.", "Follow neurologist’s advice — as part of a safe, steady recovery routine for this condition."],
  "Personality disorder": ["Follow psychotherapy plan — since consistent routines and support networks are a core part of managing this condition.", "Avoid substance use — as part of a safe, steady recovery routine for this condition.", "Build healthy relationships — as part of a safe, steady recovery routine for this condition.", "Maintain regular routines — as part of a safe, steady recovery routine for this condition."],
  "Pneumonia": ["Take full course of antibiotics — but only when a bacterial cause is confirmed by a clinician.", "Avoid smoking — since smoke irritates and further inflames already-sensitive tissue.", "Rest adequately — to give the body's natural repair processes time to work without added strain.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes."],
  "Problem during pregnancy": ["Attend regular prenatal visits — as part of a safe, steady recovery routine for this condition.", "Avoid alcohol and smoking — since alcohol can worsen inflammation, interact with medications, and slow healing.", "Eat a balanced diet — as part of a safe, steady recovery routine for this condition.", "Get adequate rest — to give the body's natural repair processes time to work without added strain."],
  "Psoriasis": ["Keep skin moisturized — to protect the area and reduce itching or irritation while it heals.", "Avoid triggers like stress — to prevent a flare-up before it starts.", "Use prescribed creams — to target the irritation directly and speed up healing.", "Avoid scratching — since scratching can break the skin and lead to secondary infection."],
  "Pyogenic skin infection": ["Keep wound clean and dry — as part of a safe, steady recovery routine for this condition.", "Avoid scratching — since scratching can break the skin and lead to secondary infection.", "Take prescribed antibiotics — but only when a bacterial cause is confirmed by a clinician.", "Cover infected area — as part of a safe, steady recovery routine for this condition."],
  "Rectal disorder": ["Eat a high-fiber diet — as part of a safe, steady recovery routine for this condition.", "Drink plenty of water — as part of a safe, steady recovery routine for this condition.", "Avoid straining during bowel movements — to prevent re-injury while the area heals.", "Use sitz baths — which soothes the area and promotes healing with warm, clean water."],
  "Schizophrenia": ["Adhere to medication — as part of a safe, steady recovery routine for this condition.", "Avoid substance abuse — as part of a safe, steady recovery routine for this condition.", "Attend therapy sessions — since consistent routines and support networks are a core part of managing this condition.", "Build a support network — as part of a safe, steady recovery routine for this condition."],
  "Seasonal allergies (hay fever)": ["Keep windows closed during high pollen — as part of a safe, steady recovery routine for this condition.", "Shower after being outdoors — as part of a safe, steady recovery routine for this condition.", "Use air purifier — as part of a safe, steady recovery routine for this condition.", "Take antihistamines — as part of a safe, steady recovery routine for this condition."],
  "Sebaceous cyst": ["Keep area clean — as part of a safe, steady recovery routine for this condition.", "Avoid squeezing — as part of a safe, steady recovery routine for this condition.", "Apply warm compress — to loosen congestion and improve comfort.", "Get it drained by a doctor if needed — as part of a safe, steady recovery routine for this condition."],
  "Sepsis": ["Seek urgent medical care — as part of a safe, steady recovery routine for this condition.", "Follow antibiotic regimen — but only when a bacterial cause is confirmed by a clinician.", "Monitor temperature & vitals — as part of a safe, steady recovery routine for this condition.", "Maintain good hygiene — to reduce the chance of re-infection or spreading it to others."],
  "Sickle cell crisis": ["Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid extreme temperatures — as part of a safe, steady recovery routine for this condition.", "Prevent infections — as part of a safe, steady recovery routine for this condition.", "Take prescribed medication regularly — exactly as directed, since stopping early or skipping doses can let symptoms rebound."],
  "Sinus bradycardia": ["Avoid excessive physical strain — as part of a safe, steady recovery routine for this condition.", "Regular cardiac monitoring — as part of a safe, steady recovery routine for this condition.", "Follow-up with cardiologist — so treatment can be adjusted based on how you're responding.", "Manage electrolyte balance — as part of a safe, steady recovery routine for this condition."],
  "Skin pigmentation disorder": ["Use sunscreen daily — since UV exposure is a major driver of the underlying skin changes.", "Avoid skin irritants — as part of a safe, steady recovery routine for this condition.", "Follow dermatological treatments — as part of a safe, steady recovery routine for this condition.", "Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes."],
  "Skin polyp": ["Avoid irritation or injury to area — as part of a safe, steady recovery routine for this condition.", "Monitor size and appearance — as part of a safe, steady recovery routine for this condition.", "Don’t self-remove — as part of a safe, steady recovery routine for this condition.", "Seek medical evaluation — as part of a safe, steady recovery routine for this condition."],
  "Spinal stenosis": ["Avoid high-impact activities — as part of a safe, steady recovery routine for this condition.", "Use walking support — as part of a safe, steady recovery routine for this condition.", "Physical therapy — to gradually rebuild strength, flexibility, and range of motion.", "Take anti-inflammatory meds — exactly as directed, since stopping early or skipping doses can let symptoms rebound."],
  "Spondylosis": ["Maintain good posture — to reduce mechanical strain on the affected area during daily activity.", "Exercise regularly — since regular movement supports circulation, mood, and long-term symptom control.", "Use ergonomic chairs — to reduce mechanical strain on the affected area during daily activity.", "Avoid lifting heavy weights — to prevent re-injury while the area heals."],
  "Spontaneous abortion": ["Take emotional support — as part of a safe, steady recovery routine for this condition.", "Rest adequately — to give the body's natural repair processes time to work without added strain.", "Avoid strenuous activity — to avoid aggravating the area before it's fully healed.", "Follow up for check-up — so treatment can be adjusted based on how you're responding."],
  "Sprain or strain": ["Rest the area — to give the body's natural repair processes time to work without added strain.", "Apply ice packs — to reduce swelling and numb discomfort in the early stages.", "Compression with bandage — to reduce swelling and support circulation while healing.", "Elevate the limb — to reduce swelling and support circulation while healing."],
  "Strep throat": ["Complete full antibiotic course — but only when a bacterial cause is confirmed by a clinician.", "Avoid sharing utensils — to avoid spreading the infection to others or reinfecting yourself.", "Get adequate rest — to give the body's natural repair processes time to work without added strain.", "Drink warm fluids — since adequate fluids support circulation, digestion, and the body's natural recovery processes."],
  "Stye": ["Apply warm compress — to loosen congestion and improve comfort.", "Avoid touching or squeezing — since friction or contamination can worsen irritation or spread infection.", "Maintain eyelid hygiene — as part of a safe, steady recovery routine for this condition.", "Discontinue eye makeup temporarily — as part of a safe, steady recovery routine for this condition."],
  "Temporary or benign blood in urine": ["Stay hydrated — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Avoid strenuous activity — to avoid aggravating the area before it's fully healed.", "Avoid certain medications (as advised) — as part of a safe, steady recovery routine for this condition.", "Follow up with doctor — so treatment can be adjusted based on how you're responding."],
  "Threatened pregnancy": ["Take prescribed medications — exactly as directed, since stopping early or skipping doses can let symptoms rebound.", "Avoid stress and lifting heavy items — since stress hormones can worsen physical symptoms and slow recovery.", "Get regular checkups — as part of a safe, steady recovery routine for this condition.", "Rest as recommended — to give the body's natural repair processes time to work without added strain."],
  "Urinary tract infection": ["Drink plenty of fluids — since adequate fluids support circulation, digestion, and the body's natural recovery processes.", "Urinate after sex — as part of a safe, steady recovery routine for this condition.", "Wipe front to back — to prevent bacteria from the bowel reaching the urinary or genital area.", "Complete antibiotic course — but only when a bacterial cause is confirmed by a clinician."],
  "Vaginal cyst": ["Maintain genital hygiene — to reduce irritation and lower the risk of infection.", "Avoid tight clothing — as part of a safe, steady recovery routine for this condition.", "Do warm sitz baths — which soothes the area and promotes healing with warm, clean water.", "Follow doctor’s advice — so care stays consistent and adjustments happen before problems escalate."],
  "Vaginitis": ["Wear breathable cotton underwear — as part of a safe, steady recovery routine for this condition.", "Avoid douching — as part of a safe, steady recovery routine for this condition.", "Maintain genital hygiene — to reduce irritation and lower the risk of infection.", "Avoid scented hygiene products — as part of a safe, steady recovery routine for this condition."],
  "Vulvodynia": ["Wear loose cotton clothing — as part of a safe, steady recovery routine for this condition.", "Avoid scented products — since fragrances and dyes are common irritants that can trigger flare-ups.", "Use prescribed creams — to target the irritation directly and speed up healing.", "Manage stress levels — since stress and physical symptoms often reinforce each other."],
};

const DIETS_DB = {
  "Actinic keratosis": ["Antioxidant-rich foods (berries, spinach, nuts) — which helps protect cells from further damage and supports healing.", "Vitamin E-rich foods (almonds, sunflower seeds) — an antioxidant that helps protect and repair skin and cell tissue.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Green tea — which has mild antioxidant and anti-inflammatory properties.", "Avoid excessive sun exposure — since sun exposure is a direct trigger for this condition."],
  "Acute bronchiolitis": ["Hydration (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair.", "Protein-rich foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Avoid dairy if mucus increases — since dairy can thicken mucus for some people during respiratory illness.", "Anti-inflammatory foods (ginger, turmeric) — which helps calm irritated or inflamed tissue."],
  "Acute bronchitis": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (citrus fruits, bell peppers) — which supports immune function and tissue repair.", "Avoid dairy if mucus increases — since dairy can thicken mucus for some people during respiratory illness.", "Anti-inflammatory foods (ginger, turmeric) — which helps calm irritated or inflamed tissue.", "Protein-rich foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair."],
  "Acute bronchospasm": ["Anti-inflammatory foods (ginger, turmeric) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (wild salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Vitamin C-rich foods (citrus fruits) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid dairy if mucus increases — since dairy can thicken mucus for some people during respiratory illness."],
  "Acute kidney injury": ["Low-protein diet (consult doctor) — to reduce the waste load the kidneys need to filter, as advised by your doctor.", "Limit sodium (avoid processed foods) — to reduce fluid retention and blood pressure strain.", "Potassium regulation (bananas, potatoes – based on medical advice) — important for nerve and muscle function, though intake should be guided by your care team if kidney function is affected.", "Hydration monitoring — to support circulation, digestion, and the body's natural recovery processes.", "Avoid high-phosphorus foods (dairy, nuts) — since excess phosphorus can build up when kidney function is impaired."],
  "Acute pancreatitis": ["Low-fat foods (boiled vegetables, lean chicken breast) — to reduce the workload on the digestive system and the organ involved.", "Small frequent meals — which is easier on the digestive system than large meals.", "Broths and clear liquids (chicken broth, vegetable broth) — which is gentle on the digestive system while it recovers.", "Avoid alcohol and caffeine — since both can worsen symptoms or interact with treatment.", "Lean proteins (tofu, white fish) — which supplies the building blocks the body needs for tissue repair."],
  "Acute sinusitis": ["Spicy foods (hot peppers, horseradish) — which can help temporarily loosen congestion for some people.", "Hydration (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair.", "Warm teas (ginger, chamomile) — which soothes irritated tissue and helps loosen mucus.", "Avoid processed sugars — since these can promote inflammation and worsen symptoms over time."],
  "Allergy": ["Elimination diet (avoid allergen foods) — to identify and remove specific food triggers.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Vitamin C-rich foods (oranges, bell peppers) — which supports immune function and tissue repair.", "Quercetin-rich foods (apples, onions) — a natural antihistamine-like compound that may ease allergy symptoms.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Angina": ["Heart-healthy diet (oats, olive oil, fish) — which supports healthy blood vessels and reduces cardiovascular strain.", "Omega-3 fatty acids (salmon, flaxseed) — which helps reduce inflammation and supports heart and brain health.", "Low-sodium foods — to reduce fluid retention and ease strain on the heart and blood vessels.", "Fruits and vegetables — for the vitamins, minerals, and fiber that support overall recovery.", "Avoid trans fats and red meat — since these can promote inflammation and worsen symptoms over time."],
  "Anxiety": ["Magnesium-rich foods (nuts, seeds) — which helps calm the nervous system and ease muscle tension.", "Omega-3 fatty acids (salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Vitamin B-complex foods (whole grains, eggs) — which supports nerve function and helps the body manage stress.", "Probiotics (kimchi, yogurt) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Limit caffeine and sugar — since both can worsen symptoms or interfere with sleep and recovery."],
  "Appendicitis": ["Post-surgery: soft foods (broths, rice, applesauce) — which is gentle on the digestive system while it recovers.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid high-fat and spicy foods — which can help temporarily loosen congestion for some people.", "Gradually introduce fiber (vegetables, fruits) — which promotes regular, comfortable bowel movements.", "Probiotics — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Arthritis of the hip": ["Anti-inflammatory foods (olive oil, turmeric, berries) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (fish, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Calcium-rich foods (dairy, leafy greens) — which supports bone strength and muscle function.", "Vitamin D-rich foods (fortified milk, egg yolk) — which supports bone strength and muscle function.", "Maintain healthy weight diet — since maintaining a healthy weight reduces strain on the affected system."],
  "Asthma": ["Anti-inflammatory foods (blueberries, kale, turmeric) — which helps calm irritated or inflamed tissue.", "Magnesium-rich foods (pumpkin seeds, spinach) — which helps calm the nervous system and ease muscle tension.", "Omega-3s (wild salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Avoid dairy if sensitive — since dairy can thicken mucus for some people during respiratory illness.", "Vitamin D-rich foods (egg yolks, fortified milk) — which supports bone strength and muscle function."],
  "Benign prostatic hyperplasia (BPH)": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Limit caffeine and alcohol — since both can worsen symptoms or interfere with sleep and recovery.", "Zinc-rich foods (pumpkin seeds, beef) — which supports immune function and tissue repair.", "Tomatoes (lycopene) — for antioxidants that may help reduce inflammation.", "High-fiber foods (whole grains, fruits, vegetables) — which promotes regular, comfortable bowel movements."],
  "Brachial neuritis": ["Protein-rich foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Vitamin B complex (whole grains, eggs) — which supports nerve function and helps the body manage stress.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Bursitis": ["Anti-inflammatory foods (turmeric, ginger, berries) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Vitamin C (bell peppers, citrus fruits) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid processed and fried foods — since these tend to promote inflammation and offer little nutritional support during recovery."],
  "Carpal tunnel syndrome": ["Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (chia seeds, salmon) — which helps reduce inflammation and supports heart and brain health.", "Magnesium-rich foods (spinach, almonds) — which helps calm the nervous system and ease muscle tension.", "Vitamin B6-rich foods (bananas, poultry) — which supports nerve function and helps the body manage stress.", "Avoid excess caffeine and sugar — since these can worsen inflammation or trigger symptoms."],
  "Cholecystitis": ["Low-fat diet (lean proteins, vegetables) — which supplies the building blocks the body needs for tissue repair.", "Avoid fried and fatty foods — since these can worsen inflammation or trigger symptoms.", "High-fiber foods (whole grains, fruits) — which promotes regular, comfortable bowel movements.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Small frequent meals — which is easier on the digestive system than large meals."],
  "Chronic back pain": ["Anti-inflammatory foods (berries, turmeric) — which helps calm irritated or inflamed tissue.", "Calcium and Vitamin D (milk, cheese, eggs) — which supports bone strength and muscle function.", "Magnesium-rich foods (nuts, leafy greens) — which helps calm the nervous system and ease muscle tension.", "Omega-3s (salmon) — which helps reduce inflammation and supports heart and brain health."],
  "Chronic constipation": ["High-fiber foods (whole grains, fruits, vegetables) — which promotes regular, comfortable bowel movements.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Probiotics (yogurt, kimchi) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Limit processed and fatty foods — since these tend to promote inflammation and offer little nutritional support during recovery.", "Regular meals and physical activity — since consistent routines help stabilize symptoms over time."],
  "Chronic obstructive pulmonary disease (COPD)": ["Anti-inflammatory foods (turmeric, ginger, berries) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (wild salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "High-protein foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (oranges, broccoli) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Common cold": ["Hydration (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (citrus, kiwi) — which supports immune function and tissue repair.", "Zinc-rich foods (nuts, seeds) — which supports immune function and tissue repair.", "Chicken soup — a traditional remedy that provides fluids, warmth, and mild anti-inflammatory benefit.", "Avoid dairy if mucus increases — since dairy can thicken mucus for some people during respiratory illness."],
  "Complex regional pain syndrome": ["Anti-inflammatory foods (turmeric, berries, leafy greens) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Magnesium-rich foods (spinach, almonds) — which helps calm the nervous system and ease muscle tension.", "Vitamin D-rich foods (fortified milk, egg yolks) — which supports bone strength and muscle function.", "Avoid processed sugars and alcohol — since these can promote inflammation and worsen symptoms over time."],
  "Concussion": ["Omega-3 fatty acids (chia seeds, salmon) — which helps reduce inflammation and supports heart and brain health.", "Antioxidant-rich foods (blueberries, dark chocolate) — which helps protect cells from further damage and supports healing.", "Protein-rich foods (eggs, chicken) — which supplies the building blocks the body needs for tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "B vitamins (whole grains, leafy greens) — which provides steady energy and supports digestion."],
  "Conjunctivitis": ["Vitamin A-rich foods (carrots, spinach) — which supports skin healing and immune defense.", "Zinc-rich foods (pumpkin seeds) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Probiotics (yogurt) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Avoid dairy if allergic — since dairy can thicken mucus for some people during respiratory illness."],
  "Conjunctivitis due to allergy": ["Antihistamine-rich foods (quercetin in apples, onions) — a natural antihistamine-like compound that may ease allergy symptoms.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Vitamin C-rich foods (citrus) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid allergens — to prevent triggering a reaction."],
  "Contact dermatitis": ["Avoid allergenic foods — to prevent triggering a reaction.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue.", "Hydrating fluids — to keep tissues moist and support the body's recovery processes.", "Vitamin E-rich foods (nuts, seeds) — an antioxidant that helps protect and repair skin and cell tissue.", "Probiotics (fermented foods) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Cornea infection": ["Vitamin A-rich foods (carrots, sweet potatoes, spinach) — which supports skin healing and immune defense.", "Zinc-rich foods (pumpkin seeds, beef) — which supports immune function and tissue repair.", "Hydration (water) — to support circulation, digestion, and the body's natural recovery processes.", "Avoid alcohol and smoking — since both can worsen symptoms or interact with treatment.", "Omega-3-rich foods (flaxseed, salmon) — which helps reduce inflammation and supports heart and brain health."],
  "Croup": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Humidified air — to keep tissues moist and support the body's recovery processes.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair.", "Avoid dairy if mucus worsens — since dairy can thicken mucus for some people during respiratory illness.", "Soft, easy to swallow foods (soups, smoothies) — since it's gentle on the digestive system while it settles."],
  "Cystitis": ["Hydration (water, cranberry juice) — to support circulation, digestion, and the body's natural recovery processes.", "Avoid caffeine and alcohol — since both can worsen symptoms or interact with treatment.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Avoid spicy and acidic foods — since these can irritate already-sensitive tissue."],
  "Degenerative disc disease": ["Calcium-rich foods (milk, cheese) — which supports bone strength and muscle function.", "Vitamin D-rich foods (fatty fish, egg yolk) — which supports bone strength and muscle function.", "Anti-inflammatory foods (berries, leafy greens) — which helps calm irritated or inflamed tissue.", "Magnesium sources (pumpkin seeds, almonds) — which helps calm the nervous system and ease muscle tension.", "Protein-rich foods (chicken, legumes) — which supplies the building blocks the body needs for tissue repair."],
  "Dental caries": ["Calcium-rich foods (milk, cheese) — which supports bone strength and muscle function.", "Vitamin D-rich foods (fatty fish, fortified cereals) — which supports bone strength and muscle function.", "Limit sugary and sticky foods — since sugar feeds bacteria and can worsen inflammation.", "Crunchy fruits and vegetables (apples, carrots) — for the vitamins, minerals, and fiber that support overall recovery.", "Green tea — which has mild antioxidant and anti-inflammatory properties."],
  "Depression": ["Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Vitamin D-rich foods (egg yolk, fortified cereals) — which supports bone strength and muscle function.", "Complex carbs (whole grains, legumes) — which provides steady energy and supports digestion.", "Folate-rich foods (leafy greens, beans) — which supports energy metabolism and nerve function.", "Limit processed sugars and caffeine — since both can worsen symptoms or interfere with sleep and recovery."],
  "Developmental disability": ["Balanced, nutrient-dense diet — since maintaining a healthy weight reduces strain on the affected system.", "Omega-3 fatty acids (fish, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "B vitamins (whole grains, meat) — which provides steady energy and supports digestion.", "Fiber-rich foods — which promotes regular, comfortable bowel movements.", "Limit sugar and artificial additives — since sugar feeds bacteria and can worsen inflammation."],
  "Diaper rash": ["Breastfeeding (for infants) — which provides antibodies and easy-to-digest nutrition for infants.", "For older babies: Avoid acidic foods (tomatoes, citrus) — since acidic foods can irritate sensitive mouths or digestive tracts.", "Probiotics (yogurt) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Zinc-rich foods (eggs, meat) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Diverticulitis": ["Low-fiber diet during flare-up (white bread, white rice) — which promotes regular, comfortable bowel movements.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Gradual increase to high-fiber diet (fruits, vegetables, whole grains) — which promotes regular, comfortable bowel movements.", "Avoid nuts and seeds during flare-ups — since these can aggravate symptoms during an active flare-up.", "Probiotics — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Drug reaction": ["Balanced diet with antioxidants (berries, leafy greens) — which helps protect cells from further damage and supports healing.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid processed and allergenic foods — since these tend to promote inflammation and offer little nutritional support during recovery.", "Vitamin C and E-rich foods (nuts, seeds, citrus) — which supports immune function and tissue repair.", "Consult doctor for specific restrictions — since individual dietary needs can vary significantly with this condition."],
  "Ear drum damage": ["Protein-rich foods (lean meats, eggs) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (citrus, broccoli) — which supports immune function and tissue repair.", "Zinc-rich foods (shellfish, pumpkin seeds) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid irritants — since irritants can directly trigger or worsen symptoms."],
  "Eczema": ["Anti-inflammatory foods (turmeric, blueberries) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Avoid allergenic foods (dairy, gluten) — which some people find worsens digestive symptoms.", "Probiotics — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Vitamin D (eggs, mushrooms) — which supports bone strength and muscle function."],
  "Esophagitis": ["Soft, bland diet (bananas, applesauce, oatmeal) — since it's gentle on the digestive system while it settles.", "Avoid spicy, acidic, and fatty foods — since these can irritate already-sensitive tissue.", "Small frequent meals — which is easier on the digestive system than large meals.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid caffeine and alcohol — since both can worsen symptoms or interact with treatment."],
  "Eustachian tube dysfunction (ear disorder)": ["Anti-inflammatory foods (berries, leafy greens) — which helps calm irritated or inflamed tissue.", "Vitamin C-rich foods (oranges, peppers) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid dairy if congestion worsens — since dairy can thicken mucus for some people during respiratory illness.", "Probiotics (yogurt) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Fungal infection of the hair": ["Antifungal foods (garlic, coconut oil) — which may help support the body's natural defense against fungal overgrowth.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Vitamin E-rich foods (nuts, seeds) — an antioxidant that helps protect and repair skin and cell tissue.", "Zinc-rich foods (beef, pumpkin seeds) — which supports immune function and tissue repair.", "Avoid sugar and processed foods — since these tend to promote inflammation and offer little nutritional support during recovery."],
  "Gallstone": ["Low-fat diet (steamed vegetables, lean meats) — to reduce the workload on the digestive system and the organ involved.", "High-fiber foods (whole grains, apples) — which promotes regular, comfortable bowel movements.", "Avoid fried foods and refined carbs — since these tend to promote inflammation with little nutritional benefit.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Small frequent meals — which is easier on the digestive system than large meals."],
  "Gastrointestinal hemorrhage": ["Avoid spicy and acidic foods — since these can irritate already-sensitive tissue.", "Bland diet (bananas, rice, applesauce) — since it's gentle on the digestive system while it settles.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Iron-rich foods post bleeding (spinach, beans) — to help replenish iron lost through bleeding.", "Avoid alcohol and NSAIDs — since both can worsen symptoms or interact with treatment."],
  "Gout": ["Low-purine foods (vegetables, whole grains) — which provides steady energy and supports digestion.", "Cherries and berries — for antioxidants that may help reduce inflammation.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Limit red meat and seafood — since these can worsen inflammation or trigger symptoms.", "Avoid alcohol and sugary drinks — since both can worsen symptoms or interact with treatment."],
  "Gum disease": ["Vitamin C-rich foods (citrus fruits, strawberries) — which supports immune function and tissue repair.", "Calcium-rich foods (milk, yogurt) — which supports bone strength and muscle function.", "Green tea — which has mild antioxidant and anti-inflammatory properties.", "Avoid sugary and sticky foods — as part of a balanced diet that supports recovery.", "Omega-3 fatty acids (walnuts, flaxseeds) — which helps reduce inflammation and supports heart and brain health."],
  "Heart attack": ["Low-sodium diet (vegetables, fresh fruits) — to reduce fluid retention and ease strain on the heart and blood vessels.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Whole grains (brown rice, oats) — which provides steady energy and supports digestion.", "Lean proteins (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Limit saturated and trans fats (processed foods, fried foods) — since these can worsen inflammation or trigger symptoms."],
  "Heart failure": ["Low-sodium diet — to reduce fluid retention and ease strain on the heart and blood vessels.", "Fluid monitoring — as part of a balanced diet that supports recovery.", "Potassium-rich foods (bananas, sweet potatoes) — important for nerve and muscle function, though intake should be guided by your care team if kidney function is affected.", "Omega-3 fatty acids (fish) — which helps reduce inflammation and supports heart and brain health.", "Avoid red meat and saturated fats — since these can promote inflammation and worsen symptoms over time."],
  "Hemorrhoids": ["High-fiber foods (whole grains, fruits, vegetables) — which promotes regular, comfortable bowel movements.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid straining and constipation — as part of a balanced diet that supports recovery.", "Limit caffeine and alcohol — since both can worsen symptoms or interfere with sleep and recovery.", "Probiotics (yogurt, kimchi) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Herniated disk": ["Anti-inflammatory diet (ginger, leafy greens) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (fish, flaxseed) — which helps reduce inflammation and supports heart and brain health.", "Vitamin D and calcium (fortified foods, milk) — which supports bone strength and muscle function.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Hiatal hernia": ["Small, frequent meals — as part of a balanced diet that supports recovery.", "Avoid spicy foods and caffeine — which can help temporarily loosen congestion for some people.", "High-fiber foods (oats, vegetables) — which promotes regular, comfortable bowel movements.", "Lean proteins (chicken, fish) — which supplies the building blocks the body needs for tissue repair.", "Avoid fatty and fried foods — as part of a balanced diet that supports recovery."],
  "Hyperemesis gravidarum": ["Small frequent meals — which is easier on the digestive system than large meals.", "Bland foods (crackers, rice) — as part of a balanced diet that supports recovery.", "Ginger tea — as part of a balanced diet that supports recovery.", "Vitamin B6-rich foods (bananas, chickpeas) — which supports nerve function and helps the body manage stress.", "Hydration with electrolytes (ORS, coconut water) — to support circulation, digestion, and the body's natural recovery processes."],
  "Hypertensive heart disease": ["Low-sodium diet (avoid processed foods) — to reduce fluid retention and ease strain on the heart and blood vessels.", "Potassium-rich foods (bananas, sweet potatoes) — important for nerve and muscle function, though intake should be guided by your care team if kidney function is affected.", "Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Whole grains (brown rice, oats) — which provides steady energy and supports digestion.", "Limit saturated fats (butter, fatty meats) — as part of a balanced diet that supports recovery."],
  "Hypoglycemia": ["Complex carbohydrates (whole grains, legumes) — which provides steady energy and supports digestion.", "Protein with every meal (eggs, nuts) — as part of a balanced diet that supports recovery.", "Avoid sugary snacks — as part of a balanced diet that supports recovery.", "Frequent small meals — as part of a balanced diet that supports recovery.", "Fiber-rich foods (vegetables, fruits) — which promotes regular, comfortable bowel movements."],
  "Idiopathic excessive menstruation": ["Iron-rich foods (spinach, red meat) — to help replenish iron lost through bleeding.", "Vitamin C-rich foods (oranges, bell peppers) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid caffeine and alcohol — since both can worsen symptoms or interact with treatment.", "High-fiber foods (whole grains, fruits) — which promotes regular, comfortable bowel movements."],
  "Idiopathic irregular menstrual cycle": ["Balanced diet with protein (chicken, beans) — as part of a balanced diet that supports recovery.", "Iron-rich foods (spinach, lentils) — to help replenish iron lost through bleeding.", "Vitamin B6-rich foods (bananas, poultry) — which supports nerve function and helps the body manage stress.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid caffeine and high sugar foods — since both can worsen symptoms or interact with treatment."],
  "Idiopathic painful menstruation": ["Magnesium-rich foods (spinach, dark chocolate) — which helps calm the nervous system and ease muscle tension.", "Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid salty and processed foods — as part of a balanced diet that supports recovery.", "Ginger and turmeric tea — as part of a balanced diet that supports recovery."],
  "Infectious gastroenteritis": ["Oral rehydration solution (ORS) — to support circulation, digestion, and the body's natural recovery processes.", "BRAT diet (bananas, rice, applesauce, toast) — as part of a balanced diet that supports recovery.", "Clear soups (chicken soup) — a traditional remedy that provides fluids, warmth, and mild anti-inflammatory benefit.", "Avoid dairy and greasy foods — since dairy can thicken mucus for some people during respiratory illness.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Injury to the arm": ["Protein-rich foods (chicken, eggs, legumes) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (citrus fruits, strawberries) — which supports immune function and tissue repair.", "Zinc sources (beef, pumpkin seeds) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue."],
  "Injury to the leg": ["Protein-rich foods (lean meats, beans) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair.", "Zinc-rich foods (shellfish, pumpkin seeds) — which supports immune function and tissue repair.", "Anti-inflammatory spices (ginger, turmeric) — which helps calm irritated or inflamed tissue.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Injury to the trunk": ["High-protein foods (tofu, lean meats) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (bell peppers, kiwi) — which supports immune function and tissue repair.", "Zinc sources (shellfish, nuts) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Anti-inflammatory spices (ginger, turmeric) — which helps calm irritated or inflamed tissue."],
  "Liver disease": ["Low sodium diet (avoid processed foods) — to reduce fluid retention and ease strain on the heart and blood vessels.", "High-protein foods (eggs, lean meats) — which supplies the building blocks the body needs for tissue repair.", "Vitamin-rich foods (leafy greens, fruits) — as part of a balanced diet that supports recovery.", "Avoid alcohol and saturated fats — since both can worsen symptoms or interact with treatment.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Macular degeneration": ["Vitamin A-rich foods (carrots, sweet potatoes) — which supports skin healing and immune defense.", "Lutein and zeaxanthin foods (spinach, kale) — as part of a balanced diet that supports recovery.", "Omega-3 fatty acids (fish, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Zinc-rich foods (pumpkin seeds, beef) — which supports immune function and tissue repair.", "Antioxidant-rich foods (blueberries, citrus) — which helps protect cells from further damage and supports healing."],
  "Marijuana abuse": ["Hydration (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Omega-3s for brain health (walnuts, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Foods rich in B vitamins (eggs, poultry, leafy greens) — which supports energy metabolism and nerve function.", "Antioxidant-rich foods (berries, nuts) — which helps protect cells from further damage and supports healing.", "Limit processed foods — as part of a balanced diet that supports recovery."],
  "Multiple sclerosis": ["Omega-3 fatty acids (flaxseeds, salmon) — which helps reduce inflammation and supports heart and brain health.", "Vitamin D-rich foods (eggs, fortified milk) — which supports bone strength and muscle function.", "Antioxidant-rich foods (berries, spinach) — which helps protect cells from further damage and supports healing.", "Limit saturated fats — as part of a balanced diet that supports recovery.", "Probiotics — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Noninfectious gastroenteritis": ["Bland diet (bananas, rice, applesauce) — since it's gentle on the digestive system while it settles.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid spicy, fatty, and dairy foods — as part of a balanced diet that supports recovery.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Small frequent meals — which is easier on the digestive system than large meals."],
  "Nose disorder": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (citrus, strawberries) — which supports immune function and tissue repair.", "Zinc-rich foods (meat, seeds) — which supports immune function and tissue repair.", "Avoid allergens and irritants — to prevent triggering a reaction.", "Warm fluids and anti-inflammatory foods (ginger, honey) — which helps calm irritated or inflamed tissue."],
  "Obstructive sleep apnea (OSA)": ["Weight management diet (calorie control) — as part of a balanced diet that supports recovery.", "Avoid alcohol and sedatives — since both can worsen symptoms or interact with treatment.", "High-fiber foods (whole grains, fruits) — which promotes regular, comfortable bowel movements.", "Avoid heavy meals before bedtime — as part of a balanced diet that supports recovery.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Otitis externa (swimmer's ear)": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid irritants and allergens — since irritants can directly trigger or worsen symptoms.", "Vitamin C-rich foods (citrus fruits, bell peppers) — which supports immune function and tissue repair.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Otitis media": ["Hydrating fluids (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C-rich foods (citrus fruits) — which supports immune function and tissue repair.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Avoid dairy if it increases mucus — since dairy can thicken mucus for some people during respiratory illness.", "Anti-inflammatory foods (ginger, turmeric) — which helps calm irritated or inflamed tissue."],
  "Pain after an operation": ["High-protein foods (eggs, fish) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (kiwi, strawberries) — which supports immune function and tissue repair.", "Zinc-rich foods (beef, nuts) — which supports immune function and tissue repair.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Panic disorder": ["Magnesium-rich foods (spinach, pumpkin seeds, almonds) — which helps calm the nervous system and ease muscle tension.", "Omega-3 fatty acids (salmon, flaxseeds, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Complex carbs (oats, quinoa) — which provides steady energy and supports digestion.", "Green tea (L-theanine) — which has mild antioxidant and anti-inflammatory properties.", "Limit caffeine and sugar — since both can worsen symptoms or interfere with sleep and recovery."],
  "Pelvic inflammatory disease": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Protein-rich foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (citrus fruits) — which supports immune function and tissue repair.", "Avoid irritants and processed foods — since these tend to promote inflammation and offer little nutritional support during recovery.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics."],
  "Peripheral nerve disorder": ["Vitamin B-rich foods (whole grains, eggs, leafy greens) — which supports nerve function and helps the body manage stress.", "Omega-3 fatty acids (salmon, chia seeds) — which helps reduce inflammation and supports heart and brain health.", "Anti-inflammatory foods (turmeric, berries) — which helps calm irritated or inflamed tissue.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Personality disorder": ["Balanced diet — as part of a balanced diet that supports recovery.", "Omega-3 fatty acids (walnuts, flaxseed) — which helps reduce inflammation and supports heart and brain health.", "Vitamin B-complex (eggs, legumes) — which supports nerve function and helps the body manage stress.", "Magnesium-rich foods (dark chocolate, spinach) — which helps calm the nervous system and ease muscle tension.", "Avoid sugar and processed foods — since these tend to promote inflammation and offer little nutritional support during recovery."],
  "Pneumonia": ["Hydrating fluids (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Protein-rich foods (chicken, beans) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (oranges, broccoli) — which supports immune function and tissue repair.", "Avoid dairy if mucus worsens — since dairy can thicken mucus for some people during respiratory illness.", "Anti-inflammatory foods (turmeric, ginger) — which helps calm irritated or inflamed tissue."],
  "Problem during pregnancy": ["Prenatal vitamins (consult doctor) — as part of a balanced diet that supports recovery.", "Iron-rich foods (red meat, lentils, spinach) — to help replenish iron lost through bleeding.", "Folate-rich foods (leafy greens, fortified cereals) — which supports energy metabolism and nerve function.", "Calcium and Vitamin D (milk, cheese, fortified plant milk) — which supports bone strength and muscle function.", "Avoid raw fish, deli meats, unpasteurized dairy — as part of a balanced diet that supports recovery."],
  "Psoriasis": ["Anti-inflammatory foods (turmeric, ginger, berries) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, walnuts) — which helps reduce inflammation and supports heart and brain health.", "Vitamin D-rich foods (egg yolk, fortified cereals) — which supports bone strength and muscle function.", "Avoid gluten if sensitive — which some people find worsens digestive symptoms.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Pyogenic skin infection": ["Protein-rich foods (lean meat, eggs) — which supplies the building blocks the body needs for tissue repair.", "Vitamin C-rich foods (citrus fruits, kiwi) — which supports immune function and tissue repair.", "Zinc-rich foods (pumpkin seeds, nuts) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid sugary and processed foods — as part of a balanced diet that supports recovery."],
  "Rectal disorder": ["High-fiber foods (whole grains, fruits, vegetables) — which promotes regular, comfortable bowel movements.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid spicy and processed foods — as part of a balanced diet that supports recovery.", "Probiotics (yogurt, sauerkraut) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Limit caffeine and alcohol — since both can worsen symptoms or interfere with sleep and recovery."],
  "Schizophrenia": ["Omega-3 fatty acids (fish, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Complex carbs (whole grains, vegetables) — which provides steady energy and supports digestion.", "Vitamin B-complex foods (eggs, nuts) — which supports nerve function and helps the body manage stress.", "Antioxidant-rich foods (berries, citrus) — which helps protect cells from further damage and supports healing.", "Limit caffeine and processed foods — as part of a balanced diet that supports recovery."],
  "Seasonal allergies (hay fever)": ["Quercetin-rich foods (onions, apples) — a natural antihistamine-like compound that may ease allergy symptoms.", "Vitamin C-rich foods (citrus fruits) — which supports immune function and tissue repair.", "Omega-3 fatty acids (flaxseeds, fish) — which helps reduce inflammation and supports heart and brain health.", "Probiotics (yogurt, kimchi) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Avoid allergens — to prevent triggering a reaction."],
  "Sebaceous cyst": ["Anti-inflammatory foods (ginger, turmeric, leafy greens) — which helps calm irritated or inflamed tissue.", "Zinc-rich foods (pumpkin seeds, nuts) — which supports immune function and tissue repair.", "Vitamin A-rich foods (carrots, sweet potatoes) — which supports skin healing and immune defense.", "Hydration — to support circulation, digestion, and the body's natural recovery processes."],
  "Sepsis": ["High-protein foods (eggs, lean meat) — which supplies the building blocks the body needs for tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Vitamin C and zinc-rich foods (citrus fruits, pumpkin seeds) — which supports immune function and tissue repair.", "Balanced electrolyte intake — as part of a balanced diet that supports recovery.", "Consult doctor for specific nutritional support — as part of a balanced diet that supports recovery."],
  "Sickle cell crisis": ["Folate-rich foods (leafy greens, legumes) — which supports energy metabolism and nerve function.", "Hydrating fluids (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes.", "Iron-rich foods (lean meats, beans) — to help replenish iron lost through bleeding.", "Vitamin B6-rich foods (bananas, poultry) — which supports nerve function and helps the body manage stress.", "Balanced protein intake — as part of a balanced diet that supports recovery."],
  "Sinus bradycardia": ["Balanced diet with adequate electrolytes (potassium from bananas, magnesium from nuts) — which helps calm the nervous system and ease muscle tension.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Limit caffeine and alcohol — since both can worsen symptoms or interfere with sleep and recovery.", "Whole grains and lean proteins — which supplies the building blocks the body needs for tissue repair.", "Consult cardiologist — as part of a balanced diet that supports recovery."],
  "Skin pigmentation disorder": ["Vitamin C-rich foods (oranges, bell peppers) — which supports immune function and tissue repair.", "Vitamin E-rich foods (almonds, sunflower seeds) — an antioxidant that helps protect and repair skin and cell tissue.", "Beta-carotene (carrots, sweet potatoes) — as part of a balanced diet that supports recovery.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Green tea — which has mild antioxidant and anti-inflammatory properties."],
  "Skin polyp": ["Balanced diet with antioxidants (berries, leafy greens) — which helps protect cells from further damage and supports healing.", "Vitamin A-rich foods (carrots, sweet potatoes) — which supports skin healing and immune defense.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid processed and fried foods — since these tend to promote inflammation and offer little nutritional support during recovery.", "Omega-3 fatty acids (fish, flaxseeds) — which helps reduce inflammation and supports heart and brain health."],
  "Spinal stenosis": ["Anti-inflammatory foods (berries, leafy greens) — which helps calm irritated or inflamed tissue.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Calcium-rich foods (milk, cheese) — which supports bone strength and muscle function.", "Vitamin D-rich foods (egg yolk, fortified cereals) — which supports bone strength and muscle function.", "Protein-rich foods (chicken, legumes) — which supplies the building blocks the body needs for tissue repair."],
  "Spondylosis": ["Calcium-rich foods (milk, cheese, fortified plant milk) — which supports bone strength and muscle function.", "Vitamin D-rich foods (egg yolk, fortified cereals) — which supports bone strength and muscle function.", "Anti-inflammatory foods (turmeric, leafy greens) — which helps calm irritated or inflamed tissue.", "Magnesium sources (nuts, seeds) — which helps calm the nervous system and ease muscle tension.", "Omega-3 fatty acids (flaxseeds, fish) — which helps reduce inflammation and supports heart and brain health."],
  "Spontaneous abortion": ["Iron-rich foods (red meat, spinach) — to help replenish iron lost through bleeding.", "Vitamin C (citrus, strawberries) — which supports immune function and tissue repair.", "Folate-rich foods (legumes, dark leafy greens) — which supports energy metabolism and nerve function.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Comforting herbal teas — as part of a balanced diet that supports recovery."],
  "Sprain or strain": ["Protein-rich foods (lean meat, eggs) — which supplies the building blocks the body needs for tissue repair.", "Anti-inflammatory foods (ginger, turmeric) — which helps calm irritated or inflamed tissue.", "Vitamin C-rich foods (citrus fruits) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Zinc-rich foods (nuts, seeds) — which supports immune function and tissue repair."],
  "Strep throat": ["Soft foods (soups, mashed potatoes) — as part of a balanced diet that supports recovery.", "Warm teas (ginger, chamomile) — which soothes irritated tissue and helps loosen mucus.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid acidic or spicy foods — which can help temporarily loosen congestion for some people.", "Vitamin C-rich foods (oranges, strawberries) — which supports immune function and tissue repair."],
  "Stye": ["Vitamin A-rich foods (carrots, sweet potatoes) — which supports skin healing and immune defense.", "Vitamin C-rich foods (citrus) — which supports immune function and tissue repair.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health.", "Avoid eye irritants — as part of a balanced diet that supports recovery."],
  "Temporary or benign blood in urine": ["Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid irritants (spicy foods, caffeine) — which can help temporarily loosen congestion for some people.", "Balanced diet with fruits and vegetables — for the vitamins, minerals, and fiber that support overall recovery.", "Limit sodium and processed foods — to reduce fluid retention and blood pressure strain.", "Consult doctor for specific recommendations — as part of a balanced diet that supports recovery."],
  "Threatened pregnancy": ["Folic acid-rich foods (leafy greens, beans) — as part of a balanced diet that supports recovery.", "Iron-rich foods (red meat, lentils) — to help replenish iron lost through bleeding.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Balanced diet with protein (chicken, fish) — as part of a balanced diet that supports recovery.", "Avoid alcohol, caffeine, and high-mercury fish — since both can worsen symptoms or interact with treatment."],
  "Urinary tract infection": ["Hydration (water, cranberry juice) — to support circulation, digestion, and the body's natural recovery processes.", "Avoid caffeine, alcohol, and spicy foods — which can help temporarily loosen congestion for some people.", "Vitamin C-rich foods (citrus, bell peppers) — which supports immune function and tissue repair.", "Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Fiber-rich foods — which promotes regular, comfortable bowel movements."],
  "Vaginal cyst": ["Probiotics (yogurt, kefir) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Anti-inflammatory foods (berries, leafy greens) — which helps calm irritated or inflamed tissue.", "Hydration — to support circulation, digestion, and the body's natural recovery processes.", "Avoid irritants and processed foods — since these tend to promote inflammation and offer little nutritional support during recovery.", "Omega-3 fatty acids (salmon, flaxseeds) — which helps reduce inflammation and supports heart and brain health."],
  "Vaginitis": ["Probiotics (yogurt, kefir, sauerkraut) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Low-sugar diet (avoid sweets, processed sugar) — as part of a balanced diet that supports recovery.", "Garlic (raw or cooked) — as part of a balanced diet that supports recovery.", "Cranberry juice (unsweetened) — as part of a balanced diet that supports recovery.", "Hydration (water, herbal teas) — to support circulation, digestion, and the body's natural recovery processes."],
  "Vulvodynia": ["Anti-inflammatory foods (blueberries, leafy greens) — which helps calm irritated or inflamed tissue.", "Probiotics (yogurt, kimchi) — which helps restore healthy gut bacteria, especially useful after illness or antibiotics.", "Omega-3 fatty acids (flaxseeds, salmon) — which helps reduce inflammation and supports heart and brain health.", "Vitamin E-rich foods (nuts, seeds) — an antioxidant that helps protect and repair skin and cell tissue.", "Avoid irritants and processed foods — since these tend to promote inflammation and offer little nutritional support during recovery."],
};

const WORKOUTS_DB = {
  "Actinic keratosis": ["Indoor workouts: Avoid sun exposure (aim for this most days as tolerated, building up gradually).", "Gentle stretching: Maintain skin comfort (aim for this most days as tolerated, building up gradually).", "Low-sweat activities: Prevent skin irritation (aim for this most days as tolerated, building up gradually).", "Walking in shaded areas: If outdoor movement needed (aim for this most days as tolerated, building up gradually)."],
  "Acute bronchiolitis": ["Rest during illness: Avoid all exertion (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing therapy: Rebuild lung strength (start light and increase gradually, adjusting based on how symptoms respond).", "Light walking: Only after full recovery (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid dusty or polluted areas: Protect airways (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Acute bronchitis": ["Breathing exercises: Aid recovery (aim for this most days as tolerated, building up gradually).", "Rest: Essential during coughing phase (aim for this most days as tolerated, building up gradually).", "Walking: Gradually reintroduce activity (aim for this most days as tolerated, building up gradually).", "Avoid cold-air workouts: Prevent airway constriction (aim for this most days as tolerated, building up gradually)."],
  "Acute bronchospasm": ["Rest until stable: Avoid exertion during flare-ups (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Strengthen respiratory muscles (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle stretching: Promote oxygen flow (start light and increase gradually, adjusting based on how symptoms respond).", "Indoor walking: In controlled environments (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Acute kidney injury": ["Gentle activity: Like walking during recovery (only attempt this once explicitly cleared by your care team).", "Avoid dehydration: Prioritize fluids with workouts (only attempt this once explicitly cleared by your care team).", "Strength training: Only when kidney function stabilizes (only attempt this once explicitly cleared by your care team).", "Workouts under supervision: Monitor vital signs (only attempt this once explicitly cleared by your care team)."],
  "Acute pancreatitis": ["Avoid heavy lifting: Prevent strain on pancreas (only attempt this once explicitly cleared by your care team).", "Gentle stretching: Maintain flexibility (only attempt this once explicitly cleared by your care team).", "Rest: Allow healing (only attempt this once explicitly cleared by your care team).", "Breathing exercises: Reduce stress and pain (only attempt this once explicitly cleared by your care team)."],
  "Acute sinusitis": ["Nasal breathing exercises: Help open airways (aim for this most days as tolerated, building up gradually).", "Gentle yoga: Promotes drainage (aim for this most days as tolerated, building up gradually).", "Walking: Low intensity, improves circulation (aim for this most days as tolerated, building up gradually).", "Avoid cold-weather workouts: Prevent sinus aggravation (aim for this most days as tolerated, building up gradually)."],
  "Allergy": ["Indoor workouts: Avoid pollen and triggers (aim for this most days as tolerated, building up gradually).", "Yoga: Calms body and immune system (aim for this most days as tolerated, building up gradually).", "Swimming in clean pools: Clears airways (aim for this most days as tolerated, building up gradually).", "Avoid exercising in high pollution: Protect respiratory health (aim for this most days as tolerated, building up gradually)."],
  "Angina": ["Cardiac rehab exercises: Under supervision (only attempt this once explicitly cleared by your care team).", "Walking on flat ground: Safe cardiovascular option (only attempt this once explicitly cleared by your care team).", "Avoid cold-weather workouts: Prevent constriction (only attempt this once explicitly cleared by your care team).", "No heavy lifting: Can trigger symptoms (only attempt this once explicitly cleared by your care team)."],
  "Anxiety": ["Yoga: Combines movement and mindfulness (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Control physiological symptoms (start light and increase gradually, adjusting based on how symptoms respond).", "Walking in nature: Calms the mind (start light and increase gradually, adjusting based on how symptoms respond).", "Tai chi: Improve mental and emotional balance (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Appendicitis": ["Complete rest post-surgery (only attempt this once explicitly cleared by your care team).", "Physical therapy: If surgery involved (only attempt this once explicitly cleared by your care team).", "Walking: Introduced gradually (only attempt this once explicitly cleared by your care team).", "Avoid abdominal workouts until cleared (only attempt this once explicitly cleared by your care team)."],
  "Arthritis of the hip": ["Water aerobics: Low joint impact (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Maintain hip mobility (start light and increase gradually, adjusting based on how symptoms respond).", "Walking with support: Use cane if needed (start light and increase gradually, adjusting based on how symptoms respond).", "Strength training: Build support muscles around joint (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Asthma": ["Breathing exercises: Improve lung function (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga: Combines breathing and movement (start light and increase gradually, adjusting based on how symptoms respond).", "Swimming: Low-impact cardio good for lungs (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid strenuous workouts during flare-ups: Prevent attacks (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Benign prostatic hyperplasia (BPH)": ["Pelvic floor exercises: Improve urinary control (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Promotes bladder health (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid cycling: Can worsen symptoms (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Relieve pelvic tension (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Brachial neuritis": ["Range-of-motion exercises: Restore shoulder movement (start light and increase gradually, adjusting based on how symptoms respond).", "Light resistance training: Under physiotherapy (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid overhead lifting (start light and increase gradually, adjusting based on how symptoms respond).", "Pain management with guided stretching (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Bursitis": ["Gentle range-of-motion exercises: Prevent joint stiffness (aim for this most days as tolerated, building up gradually).", "Low-impact cardio: Like swimming or cycling (aim for this most days as tolerated, building up gradually).", "Stretching: Keep affected areas flexible (aim for this most days as tolerated, building up gradually).", "Avoid pressure on joints: Use proper form and padding (aim for this most days as tolerated, building up gradually)."],
  "Carpal tunnel syndrome": ["Wrist stretching: Relieve nerve pressure (aim for this most days as tolerated, building up gradually).", "Hand-strengthening exercises: Use putty or bands (aim for this most days as tolerated, building up gradually).", "Avoid repetitive strain: Modify activities (aim for this most days as tolerated, building up gradually).", "Yoga: Helps with posture and nerve health (aim for this most days as tolerated, building up gradually)."],
  "Cholecystitis": ["Gentle movement: After inflammation resolves (only attempt this once explicitly cleared by your care team).", "Avoid high-fat pre-workout meals (only attempt this once explicitly cleared by your care team).", "Walking: Improves digestion (only attempt this once explicitly cleared by your care team).", "Avoid core strain: Prevent gallbladder pressure (only attempt this once explicitly cleared by your care team)."],
  "Chronic back pain": ["Core stabilization: Essential for support (aim for this most days as tolerated, building up gradually).", "Water aerobics: Minimal spinal impact (aim for this most days as tolerated, building up gradually).", "Stretching: Hamstrings, hips, and back (aim for this most days as tolerated, building up gradually).", "Avoid high-impact sports (aim for this most days as tolerated, building up gradually)."],
  "Chronic constipation": ["Walking: Stimulates bowel movement (aim for this most days as tolerated, building up gradually).", "Yoga: Helps with digestion (aim for this most days as tolerated, building up gradually).", "Core-focused stretching: Gently activates abdomen (aim for this most days as tolerated, building up gradually).", "Hydration pre- and post-workout: Key support (aim for this most days as tolerated, building up gradually)."],
  "Chronic obstructive pulmonary disease (COPD)": ["Pursed-lip breathing: Improve oxygen use (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Build endurance safely (start light and increase gradually, adjusting based on how symptoms respond).", "Stationary biking: Low strain on lungs (start light and increase gradually, adjusting based on how symptoms respond).", "Pulmonary rehabilitation exercises: Doctor-guided regimens (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Common cold": ["Rest: Essential during acute phase (aim for this most days as tolerated, building up gradually).", "Gentle yoga: After fever subsides (aim for this most days as tolerated, building up gradually).", "Walking: Once energy returns (aim for this most days as tolerated, building up gradually).", "Breathing exercises: Open airways (aim for this most days as tolerated, building up gradually)."],
  "Complex regional pain syndrome": ["Gentle stretching: Prevent contractures (start light and increase gradually, adjusting based on how symptoms respond).", "Desensitization exercises: Rebuild nerve tolerance (start light and increase gradually, adjusting based on how symptoms respond).", "Mirror therapy: Improve brain-muscle coordination (start light and increase gradually, adjusting based on how symptoms respond).", "Aqua therapy: Low-pain water exercises (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Concussion": ["Rest: Most important early step (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle stretching: After symptoms improve (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Light activity to reintroduce movement (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid screens and bright lights: Limit visual strain (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Conjunctivitis": ["Avoid water sports: Prevent further irritation (aim for this most days as tolerated, building up gradually).", "Gentle indoor walking: Prevent eye strain (aim for this most days as tolerated, building up gradually).", "Do not share gym equipment (aim for this most days as tolerated, building up gradually).", "Clean face after workouts (aim for this most days as tolerated, building up gradually)."],
  "Conjunctivitis due to allergy": ["Indoor exercises: Avoid allergens like pollen (aim for this most days as tolerated, building up gradually).", "Gentle yoga: Avoid face touching (aim for this most days as tolerated, building up gradually).", "Stretching: Avoid eye strain (aim for this most days as tolerated, building up gradually).", "Avoid swimming: Prevent eye irritation (aim for this most days as tolerated, building up gradually)."],
  "Contact dermatitis": ["Avoid sweating heavily: Can irritate skin (aim for this most days as tolerated, building up gradually).", "Indoor stretching: Cool and dry (aim for this most days as tolerated, building up gradually).", "Use breathable clothing: During workouts (aim for this most days as tolerated, building up gradually).", "Clean skin after exercise: Prevent flare-ups (aim for this most days as tolerated, building up gradually)."],
  "Cornea infection": ["Rest the eyes: Avoid screen-heavy workouts (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle walking: Safe and non-straining (start light and increase gradually, adjusting based on how symptoms respond).", "Indoor stretching: Limits light exposure (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid swimming: Prevent waterborne pathogens (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Croup": ["Rest: Until breathing improves (start light and increase gradually, adjusting based on how symptoms respond).", "Steam inhalation: Open airways (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid exertion: May worsen symptoms (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle play: Indoors and calm once recovering (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Cystitis": ["Walking: Safe and bladder-friendly (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration focus: Before and after (start light and increase gradually, adjusting based on how symptoms respond).", "Pelvic floor exercises: Improve control (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid workouts that cause dehydration (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Degenerative disc disease": ["Back stretches: Increase flexibility (start light and increase gradually, adjusting based on how symptoms respond).", "Core strengthening: Reduce spinal pressure (start light and increase gradually, adjusting based on how symptoms respond).", "Low-impact aerobics: Walking or elliptical (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid heavy lifting: Prevent worsening symptoms (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Dental caries": ["Hydration focus: Water during exercise to reduce acid (aim for this most days as tolerated, building up gradually).", "Avoid sugary drinks: During workouts (aim for this most days as tolerated, building up gradually).", "Regular workouts: Support overall oral health (aim for this most days as tolerated, building up gradually).", "No intense jaw activities: Prevent further damage (aim for this most days as tolerated, building up gradually)."],
  "Depression": ["Aerobic exercise: Boosts mood via endorphins (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga: Mind-body balance (start light and increase gradually, adjusting based on how symptoms respond).", "Group activities: Enhance motivation (start light and increase gradually, adjusting based on how symptoms respond).", "Walking in nature: Proven to reduce symptoms (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Developmental disability": ["Occupational therapy-integrated activities (start light and increase gradually, adjusting based on how symptoms respond).", "Swimming: Enhances motor coordination (start light and increase gradually, adjusting based on how symptoms respond).", "Group play or structured fitness (start light and increase gradually, adjusting based on how symptoms respond).", "Balance and core work: Tailored to individual ability (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Diaper rash": ["Not exercise-relevant: Focus on hygiene (aim for this most days as tolerated, building up gradually).", "Avoid heat and sweat buildup (aim for this most days as tolerated, building up gradually).", "Let skin breathe (aim for this most days as tolerated, building up gradually).", "Gentle motion in open diapers (for infants) (aim for this most days as tolerated, building up gradually)."],
  "Diverticulitis": ["Rest: During acute phase (only attempt this once explicitly cleared by your care team).", "Walking: Light and easy on digestion (only attempt this once explicitly cleared by your care team).", "Avoid heavy weights: Prevent abdominal strain (only attempt this once explicitly cleared by your care team).", "Hydration support during and after workouts (only attempt this once explicitly cleared by your care team)."],
  "Drug reaction": ["Rest: While recovering from adverse reactions (start light and increase gradually, adjusting based on how symptoms respond).", "Low-intensity movement: Once stabilized (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Calm stress responses (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid sun exposure: If on photosensitive medications (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Ear drum damage": ["Avoid swimming and underwater sports (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Safe and low-impact (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Avoid head-down positions (start light and increase gradually, adjusting based on how symptoms respond).", "Protect ears from loud music/explosive sports (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Eczema": ["Avoid sweat-heavy routines (aim for this most days as tolerated, building up gradually).", "Indoor walking or light yoga (aim for this most days as tolerated, building up gradually).", "Cool, breathable workout clothing (aim for this most days as tolerated, building up gradually).", "Shower promptly after exercise (aim for this most days as tolerated, building up gradually)."],
  "Esophagitis": ["Avoid high-impact workouts post meals (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Gentle digestive aid (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Ease reflux (start light and increase gradually, adjusting based on how symptoms respond).", "No crunches or abdominal pressure (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Eustachian tube dysfunction (ear disorder)": ["Avoid pressure changes: No underwater or flying sports (aim for this most days as tolerated, building up gradually).", "Breathing and jaw exercises: Promote drainage (aim for this most days as tolerated, building up gradually).", "Gentle yoga: Avoid headstand poses (aim for this most days as tolerated, building up gradually).", "Walking: Comfortable, low pressure (aim for this most days as tolerated, building up gradually)."],
  "Fungal infection of the hair": ["Avoid shared gym equipment: Prevent spread (aim for this most days as tolerated, building up gradually).", "Indoor yoga: No sweat-heavy environments (aim for this most days as tolerated, building up gradually).", "Dry scalp after workouts: Prevent fungus growth (aim for this most days as tolerated, building up gradually).", "Low-sweat activities: Reduce moisture (aim for this most days as tolerated, building up gradually)."],
  "Gallstone": ["Avoid high-fat pre-workout meals (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Encourages digestion (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Reduce stress and spasm (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid core-focused exercises: Prevent discomfort (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Gastrointestinal hemorrhage": ["Rest: Avoid strenuous activity during active bleeding (only attempt this once explicitly cleared by your care team).", "Breathing exercises: Manage stress on the digestive system (only attempt this once explicitly cleared by your care team).", "Gentle walking: Only after stabilization (only attempt this once explicitly cleared by your care team).", "Avoid abdominal strain: Prevent re-bleeding (only attempt this once explicitly cleared by your care team)."],
  "Gout": ["Low-impact exercises: Like cycling or swimming (start light and increase gradually, adjusting based on how symptoms respond).", "Joint mobility drills: Keep joints flexible (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid intense weight-bearing: During flare-ups (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Reduce stiffness in affected areas (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Gum disease": ["Oral hygiene focus: Brush and floss regularly (aim for this most days as tolerated, building up gradually).", "Avoid sugary sports drinks: Prevent bacterial growth (aim for this most days as tolerated, building up gradually).", "Stay hydrated: Supports gum health (aim for this most days as tolerated, building up gradually).", "No specific physical activity restriction: Follow general wellness plan (aim for this most days as tolerated, building up gradually)."],
  "Heart attack": ["Cardiac rehabilitation: Doctor-supervised program (only attempt this once explicitly cleared by your care team).", "Walking: Most recommended early-stage workout (only attempt this once explicitly cleared by your care team).", "Stationary cycling: Low-impact cardio (only attempt this once explicitly cleared by your care team).", "Avoid high-intensity training: Until medically cleared (only attempt this once explicitly cleared by your care team)."],
  "Heart failure": ["Supervised cardiac rehab: Custom-designed programs (only attempt this once explicitly cleared by your care team).", "Walking: Slow and monitored (only attempt this once explicitly cleared by your care team).", "Breathing techniques: Improve oxygen efficiency (only attempt this once explicitly cleared by your care team).", "Avoid dehydration or sudden exertion (only attempt this once explicitly cleared by your care team)."],
  "Hemorrhoids": ["Walking: Reduces pressure on rectal veins (aim for this most days as tolerated, building up gradually).", "Kegel exercises: Improve blood flow (aim for this most days as tolerated, building up gradually).", "Avoid heavy lifting: Prevent flare-ups (aim for this most days as tolerated, building up gradually).", "Gentle yoga: Especially pelvic-friendly poses (aim for this most days as tolerated, building up gradually)."],
  "Herniated disk": ["McKenzie extension exercises: Under guidance (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Supports spine (start light and increase gradually, adjusting based on how symptoms respond).", "Core strengthening: Stabilizes back (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid bending/twisting under load (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Hiatal hernia": ["Avoid crunches: Prevent abdominal pressure (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle walking or cycling: Support digestion (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Improve diaphragm control (start light and increase gradually, adjusting based on how symptoms respond).", "Upright posture: During and after exercise (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Hyperemesis gravidarum": ["Gentle walking: If tolerated (start light and increase gradually, adjusting based on how symptoms respond).", "Prenatal yoga: Helps manage nausea (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid fast movements: Prevent triggering symptoms (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration breaks essential (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Hypertensive heart disease": ["Walking: Low-impact and heart-friendly (only attempt this once explicitly cleared by your care team).", "Swimming: Great cardiovascular activity (only attempt this once explicitly cleared by your care team).", "Breathing techniques: Reduce stress-induced spikes (only attempt this once explicitly cleared by your care team).", "Avoid heavy lifting: Prevent blood pressure surges (only attempt this once explicitly cleared by your care team)."],
  "Hypoglycemia": ["Walking: Helps stabilize blood sugar (only attempt this once explicitly cleared by your care team).", "Strength training: Builds muscle mass to support glucose use (only attempt this once explicitly cleared by your care team).", "Avoid fasted workouts: Always eat before (only attempt this once explicitly cleared by your care team).", "Frequent breaks: Monitor sugar levels during activity (only attempt this once explicitly cleared by your care team)."],
  "Idiopathic excessive menstruation": ["Yoga: Eases cramps and bleeding (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Low-impact movement (start light and increase gradually, adjusting based on how symptoms respond).", "Pelvic floor workouts: Support reproductive organs (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid intense cardio: Prevent symptom worsening (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Idiopathic irregular menstrual cycle": ["Moderate aerobic workouts: Regulate hormones (aim for this most days as tolerated, building up gradually).", "Yoga: Balance endocrine function (aim for this most days as tolerated, building up gradually).", "Strength training: Improves metabolic health (aim for this most days as tolerated, building up gradually).", "Avoid excessive exercise: Can disrupt cycles (aim for this most days as tolerated, building up gradually)."],
  "Idiopathic painful menstruation": ["Yoga: Especially child’s pose and reclined twist (aim for this most days as tolerated, building up gradually).", "Walking: Helps reduce cramps (aim for this most days as tolerated, building up gradually).", "Heat therapy post-exercise: Relieves pain (aim for this most days as tolerated, building up gradually).", "Avoid high-intensity workouts during pain spikes (aim for this most days as tolerated, building up gradually)."],
  "Infectious gastroenteritis": ["Rest: Allow the body to recover (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle walking: Only after symptoms improve (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration focus: Replenish fluids before any activity (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid strenuous exercise: Prevent worsening dehydration (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Injury to the arm": ["Physical therapy: Guided recovery exercises (start light and increase gradually, adjusting based on how symptoms respond).", "Range-of-motion drills: Regain flexibility (start light and increase gradually, adjusting based on how symptoms respond).", "Isometric strengthening: Build muscles without movement (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid overuse: Prioritize rest and pacing (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Injury to the leg": ["Non-weight-bearing exercises: Like swimming or seated stretches (start light and increase gradually, adjusting based on how symptoms respond).", "Range-of-motion: Prevent stiffness (start light and increase gradually, adjusting based on how symptoms respond).", "Strength training: After healing starts (start light and increase gradually, adjusting based on how symptoms respond).", "Balance exercises: Reduce fall risk later (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Injury to the trunk": ["Core stability workouts: Strengthen abdomen/back (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Ease pain and tension (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Gentle activity for circulation (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid twisting movements: Reduce risk of re-injury (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Liver disease": ["Walking: Promotes liver circulation (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid strenuous workouts: Can worsen fatigue (start light and increase gradually, adjusting based on how symptoms respond).", "Strength training (light): Improve muscle mass (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid alcohol-based environments (gyms with bars etc.): Stay safe (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Macular degeneration": ["Balance training: Prevent falls due to vision changes (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Improves circulation and eye health (start light and increase gradually, adjusting based on how symptoms respond).", "Indoor cycling: Safe with limited vision (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid fast-paced movements: Prevent injuries (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Marijuana abuse": ["Cardio workouts: Boost dopamine and mood (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga: Improve focus and reduce cravings (start light and increase gradually, adjusting based on how symptoms respond).", "Strength training: Rebuild physical health (start light and increase gradually, adjusting based on how symptoms respond).", "Group activities: Enhance social motivation and discipline (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Multiple sclerosis": ["Balance training: Prevent falls (start light and increase gradually, adjusting based on how symptoms respond).", "Aqua therapy: Joint-friendly (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Reduce stiffness (start light and increase gradually, adjusting based on how symptoms respond).", "Seated resistance training: Build strength safely (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Noninfectious gastroenteritis": ["Gentle walking: Only after rehydration (start light and increase gradually, adjusting based on how symptoms respond).", "Rest: During acute symptoms (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid abdominal strain: Prevent discomfort (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration focus: Replace electrolytes (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Nose disorder": ["Breathing techniques: Nasal breathing focus (aim for this most days as tolerated, building up gradually).", "Indoor cycling: Low impact on facial pressure (aim for this most days as tolerated, building up gradually).", "Avoid inversion poses: Prevent sinus pressure (aim for this most days as tolerated, building up gradually).", "Gentle cardio: Avoid dry, dusty air (aim for this most days as tolerated, building up gradually)."],
  "Obstructive sleep apnea (OSA)": ["Weight management exercises: Walking, swimming (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing training: Strengthen airway muscles (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga: Improve breathing and sleep quality (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid late-night workouts: Prevent sleep disruption (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Otitis externa (swimmer's ear)": ["Avoid swimming: Until healed (aim for this most days as tolerated, building up gradually).", "Walking: Gentle, safe movement (aim for this most days as tolerated, building up gradually).", "Indoor cycling: Avoid moisture exposure (aim for this most days as tolerated, building up gradually).", "Protect ears: Use dry earplugs during workouts (aim for this most days as tolerated, building up gradually)."],
  "Otitis media": ["Rest: Especially during acute phase (aim for this most days as tolerated, building up gradually).", "Avoid swimming: Prevent water exposure to ears (aim for this most days as tolerated, building up gradually).", "Light walking: If energy permits (aim for this most days as tolerated, building up gradually).", "Neck stretches: Relieve ear canal pressure (aim for this most days as tolerated, building up gradually)."],
  "Pain after an operation": ["Guided physiotherapy: Safe recovery progression (start light and increase gradually, adjusting based on how symptoms respond).", "Deep breathing: Prevent lung complications post-surgery (start light and increase gradually, adjusting based on how symptoms respond).", "Slow walking: Improves circulation (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid high-intensity activity: Allow full healing (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Panic disorder": ["Deep breathing exercises: Calm your mind by focusing on slow, deep breaths (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga: Combines breathing and movement for relaxation (start light and increase gradually, adjusting based on how symptoms respond).", "Mindfulness meditation: Helps reduce anxiety by staying present (start light and increase gradually, adjusting based on how symptoms respond).", "Regular aerobic exercise: Boosts mood and reduces stress (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Pelvic inflammatory disease": ["Pelvic floor strengthening: Aid recovery (only attempt this once explicitly cleared by your care team).", "Walking: Supports circulation (only attempt this once explicitly cleared by your care team).", "Avoid high-impact sports: Prevent discomfort (only attempt this once explicitly cleared by your care team).", "Gentle yoga: Pelvic-friendly movements (only attempt this once explicitly cleared by your care team)."],
  "Peripheral nerve disorder": ["Balance training: Prevent falls (start light and increase gradually, adjusting based on how symptoms respond).", "Physical therapy: Guided nerve rehab (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching: Maintain flexibility (start light and increase gradually, adjusting based on how symptoms respond).", "Swimming: Low-impact full-body option (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Personality disorder": ["Team sports: Encourage social interaction (start light and increase gradually, adjusting based on how symptoms respond).", "Walking or running: Structured routine helps mood (start light and increase gradually, adjusting based on how symptoms respond).", "Yoga or tai chi: Promote mindfulness (start light and increase gradually, adjusting based on how symptoms respond).", "Supervised fitness coaching: Builds discipline and trust (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Pneumonia": ["Rest: Critical during acute infection (only attempt this once explicitly cleared by your care team).", "Breathing exercises: Improve lung expansion (only attempt this once explicitly cleared by your care team).", "Gentle walking: After fever subsides (only attempt this once explicitly cleared by your care team).", "Gradual reintroduction to physical activity: To build endurance (only attempt this once explicitly cleared by your care team)."],
  "Problem during pregnancy": ["Prenatal yoga: Gentle stretches safe for pregnancy (only attempt this once explicitly cleared by your care team).", "Walking: Keeps you active and healthy (only attempt this once explicitly cleared by your care team).", "Pelvic tilts: Strengthen core muscles (only attempt this once explicitly cleared by your care team).", "Kegel exercises: Support pelvic health (only attempt this once explicitly cleared by your care team)."],
  "Psoriasis": ["Swimming in saltwater: May soothe skin (aim for this most days as tolerated, building up gradually).", "Moderate aerobic activity: Supports immune system (aim for this most days as tolerated, building up gradually).", "Stretching and yoga: Gentle on skin (aim for this most days as tolerated, building up gradually).", "Avoid hot/sweaty environments: Prevent flare-ups (aim for this most days as tolerated, building up gradually)."],
  "Pyogenic skin infection": ["Avoid shared gym equipment: Prevent spread (start light and increase gradually, adjusting based on how symptoms respond).", "No swimming: Until cleared (start light and increase gradually, adjusting based on how symptoms respond).", "Stretching at home: Avoid sweating on infected skin (start light and increase gradually, adjusting based on how symptoms respond).", "Use clean towels: Hygiene is key (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Rectal disorder": ["Walking: Supports digestion and circulation (start light and increase gradually, adjusting based on how symptoms respond).", "Pelvic floor exercises: Strengthen rectal support (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid cycling: Prevent irritation (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle yoga: Focus on posture and breathing (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Schizophrenia": ["Structured group workouts: Promote social interaction (only attempt this once explicitly cleared by your care team).", "Walking or jogging: Boosts brain chemicals (only attempt this once explicitly cleared by your care team).", "Tai chi: Improves focus and calm (only attempt this once explicitly cleared by your care team).", "Avoid sensory overload: Choose quiet environments (only attempt this once explicitly cleared by your care team)."],
  "Seasonal allergies (hay fever)": ["Indoor workouts: Avoid pollen exposure (aim for this most days as tolerated, building up gradually).", "Yoga: Manage immune and stress response (aim for this most days as tolerated, building up gradually).", "Treadmill walking: Allergy-safe cardio (aim for this most days as tolerated, building up gradually).", "Wear a mask outdoors: If walking outside (aim for this most days as tolerated, building up gradually)."],
  "Sebaceous cyst": ["Avoid pressure or friction on cyst (aim for this most days as tolerated, building up gradually).", "Low-sweat activities: Prevent irritation (aim for this most days as tolerated, building up gradually).", "Walking or yoga: With non-abrasive clothing (aim for this most days as tolerated, building up gradually).", "Avoid helmets/hats if cyst is on scalp (aim for this most days as tolerated, building up gradually)."],
  "Sepsis": ["Rest and rehabilitation: After acute phase (only attempt this once explicitly cleared by your care team).", "Gentle walking: Gradual rebuilding (only attempt this once explicitly cleared by your care team).", "Physical therapy: Restore strength (only attempt this once explicitly cleared by your care team).", "Avoid overexertion: Recovery can be long-term (only attempt this once explicitly cleared by your care team)."],
  "Sickle cell crisis": ["Rest: Avoid physical stress during crisis (only attempt this once explicitly cleared by your care team).", "Hydration focus: Essential during and after workouts (only attempt this once explicitly cleared by your care team).", "Low-intensity stretching: Once stable (only attempt this once explicitly cleared by your care team).", "Avoid high altitudes: Prevent oxygen drop (only attempt this once explicitly cleared by your care team)."],
  "Sinus bradycardia": ["Light aerobic activity: Walking or slow cycling (start light and increase gradually, adjusting based on how symptoms respond).", "Warm-up and cool-down: Essential to prevent dizziness (start light and increase gradually, adjusting based on how symptoms respond).", "Breathing exercises: Support heart rhythm (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid overexertion: Monitor heart rate (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Skin pigmentation disorder": ["Avoid sun exposure: Exercise indoors or with protection (aim for this most days as tolerated, building up gradually).", "Low-sweat activities: Prevent friction and inflammation (aim for this most days as tolerated, building up gradually).", "Yoga: Gentle and non-irritating (aim for this most days as tolerated, building up gradually).", "Hydration: Helps skin health (aim for this most days as tolerated, building up gradually)."],
  "Skin polyp": ["Avoid friction-prone exercises: Prevent irritation (aim for this most days as tolerated, building up gradually).", "Wear soft, non-abrasive clothing (aim for this most days as tolerated, building up gradually).", "Gentle yoga or walking (aim for this most days as tolerated, building up gradually).", "Monitor any changes during workout routines (aim for this most days as tolerated, building up gradually)."],
  "Spinal stenosis": ["Flexion-based exercises: Reduce spinal pressure (start light and increase gradually, adjusting based on how symptoms respond).", "Stationary biking: Low back stress (start light and increase gradually, adjusting based on how symptoms respond).", "Water therapy: Buoyant support (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid arching or extension exercises: Prevent nerve irritation (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Spondylosis": ["Neck and back stretches: Improve mobility (aim for this most days as tolerated, building up gradually).", "Posture correction exercises: Reduce strain (aim for this most days as tolerated, building up gradually).", "Tai chi or yoga: Low-impact balance and movement (aim for this most days as tolerated, building up gradually).", "Avoid high-impact sports: Prevent joint stress (aim for this most days as tolerated, building up gradually)."],
  "Spontaneous abortion": ["Gentle stretching: Emotional and physical recovery (only attempt this once explicitly cleared by your care team).", "Walking: When emotionally and physically ready (only attempt this once explicitly cleared by your care team).", "Yoga: Calms the nervous system (only attempt this once explicitly cleared by your care team).", "Avoid strenuous exercise: Until cleared by doctor (only attempt this once explicitly cleared by your care team)."],
  "Sprain or strain": ["RICE first (rest, ice, compress, elevate) (aim for this most days as tolerated, building up gradually).", "Gentle range-of-motion exercises: After pain subsides (aim for this most days as tolerated, building up gradually).", "Avoid re-injury: Use supports if needed (aim for this most days as tolerated, building up gradually).", "Rehabilitation-focused strength training (aim for this most days as tolerated, building up gradually)."],
  "Strep throat": ["Rest: Until infection clears (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid cardio: While febrile or sore throat (start light and increase gradually, adjusting based on how symptoms respond).", "Walking: Gradually after symptoms ease (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration and vocal rest after workouts (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Stye": ["Avoid swimming: Prevent bacteria exposure (aim for this most days as tolerated, building up gradually).", "Low-intensity workouts: No eye rubbing or strain (aim for this most days as tolerated, building up gradually).", "Clean face post-exercise: Prevent infection (aim for this most days as tolerated, building up gradually).", "Avoid hot yoga: May worsen swelling (aim for this most days as tolerated, building up gradually)."],
  "Temporary or benign blood in urine": ["Walking: Low strain on kidneys (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration before and after: Support urinary health (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid heavy lifting: Prevent internal pressure (start light and increase gradually, adjusting based on how symptoms respond).", "Gentle stretching: Support circulation (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Threatened pregnancy": ["Modified bed rest: Based on doctor's advice (only attempt this once explicitly cleared by your care team).", "Breathing exercises: Reduce anxiety (only attempt this once explicitly cleared by your care team).", "Pelvic floor (Kegel) exercises: Safe for pelvic support (only attempt this once explicitly cleared by your care team).", "Avoid high-impact workouts: Prevent complications (only attempt this once explicitly cleared by your care team)."],
  "Urinary tract infection": ["Walking: Gentle activity safe during mild infections (start light and increase gradually, adjusting based on how symptoms respond).", "Avoid workouts that apply pressure to bladder (start light and increase gradually, adjusting based on how symptoms respond).", "Hydration-focused workouts (start light and increase gradually, adjusting based on how symptoms respond).", "Pelvic floor exercises: Strengthen urinary control (start light and increase gradually, adjusting based on how symptoms respond)."],
  "Vaginal cyst": ["Pelvic floor exercises: Support area and reduce discomfort (aim for this most days as tolerated, building up gradually).", "Avoid high-impact sports: Prevent irritation (aim for this most days as tolerated, building up gradually).", "Walking: Safe and light activity (aim for this most days as tolerated, building up gradually).", "Breathing exercises: Promote general relaxation (aim for this most days as tolerated, building up gradually)."],
  "Vaginitis": ["Pelvic floor exercises: Strengthen pelvic muscles to reduce discomfort (aim for this most days as tolerated, building up gradually).", "Avoid tight clothing: Prevent irritation (aim for this most days as tolerated, building up gradually).", "Use cotton underwear: Helps keep area dry and breathable (aim for this most days as tolerated, building up gradually).", "Maintain hygiene: Prevent infections (aim for this most days as tolerated, building up gradually)."],
  "Vulvodynia": ["Pelvic floor relaxation: Avoid tightness (aim for this most days as tolerated, building up gradually).", "Gentle yoga: Reduce pelvic pain (aim for this most days as tolerated, building up gradually).", "Breathing techniques: Help with stress-linked flares (aim for this most days as tolerated, building up gradually).", "Avoid bike riding: Prevent pressure on sensitive area (aim for this most days as tolerated, building up gradually)."],
};

const MEDICATIONS_DB = {
  "Actinic keratosis": ["Topical 5-fluorouracil — applied directly to the affected area to limit whole-body side effects.", "Imiquimod cream — applied directly to the affected area to limit whole-body side effects.", "Diclofenac gel — relieves pain and inflammation, but should be used at the lowest effective dose.", "Cryotherapy — freezes abnormal tissue so healthy skin can regenerate in its place.", "Photodynamic therapy — uses a light-activated compound to target damaged cells with minimal effect on surrounding tissue."],
  "Acute bronchiolitis": ["Supportive care — focuses on comfort and monitoring while the body clears the illness on its own.", "Nasal suctioning — clears mucus so breathing and feeding are easier, especially in infants.", "Saline nebulization — delivers medication directly into the airways as a fine mist for faster relief.", "Oxygen therapy (if hypoxic) — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Antipyretics (e.g., Paracetamol) — relieves pain and fever with less stomach irritation than NSAIDs."],
  "Acute bronchitis": ["Cough suppressants (e.g., Dextromethorphan) — reduces the urge to cough, most useful for a dry, disruptive cough.", "Expectorants (e.g., Guaifenesin) — helps loosen and thin mucus so it's easier to clear.", "Bronchodilators (if wheezing) — relaxes airway muscles to make breathing easier.", "NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Antibiotics (only if bacterial suspected) — targets bacterial infections specifically — it won't help a viral illness."],
  "Acute bronchospasm": ["Short-acting beta-agonists (e.g., Albuterol) — relaxes airway muscles to make breathing easier.", "Anticholinergics — helps relax airway muscles, often used alongside other inhaled medications.", "Systemic corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Oxygen therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Magnesium sulfate (in severe cases) — helps relax airway muscles in more severe breathing episodes."],
  "Acute kidney injury": ["IV fluids — restores hydration and supports organ function during acute illness.", "Diuretics (e.g., Furosemide) — helps the body eliminate excess fluid, reducing swelling and strain on the heart.", "Electrolyte management — corrects imbalances that can affect heart rhythm, muscle function, and energy levels.", "Discontinue nephrotoxic drugs — removes substances that could be adding to the strain on the kidneys.", "Dialysis (if severe) — filters waste from the blood when the kidneys can no longer do so effectively."],
  "Acute pancreatitis": ["IV fluids — restores hydration and supports organ function during acute illness.", "Pain relievers (e.g., Morphine) — eases discomfort while the underlying issue is treated or resolves on its own.", "Antibiotics (if infection) — targets bacterial infections specifically — it won't help a viral illness.", "Enzyme replacement therapy — helps the digestive system break down food when natural enzyme production is impaired.", "Fasting/NPO — rests the digestive system so it isn't further irritated before or during treatment."],
  "Acute sinusitis": ["Saline nasal spray — rinses and moistens nasal passages to loosen congestion.", "Decongestants (e.g., Pseudoephedrine) — narrows swollen nasal blood vessels to relieve congestion.", "Nasal corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Antibiotics (if bacterial) — targets bacterial infections specifically — it won't help a viral illness.", "Acetaminophen for pain — relieves pain and fever with less stomach irritation than NSAIDs."],
  "Allergy": ["Antihistamines (e.g., Loratadine) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Decongestants (e.g., Pseudoephedrine) — narrows swollen nasal blood vessels to relieve congestion.", "Epinephrine auto-injectors — reverses severe allergic reactions quickly and should be used at the first sign of anaphylaxis.", "Corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Immunotherapy (allergy shots) — gradually retrains the immune system to tolerate the allergen over time."],
  "Angina": ["Nitroglycerin (sublingual) — widens blood vessels quickly to relieve chest pain during an episode.", "Beta-blockers — slows the heart rate and reduces its workload.", "Calcium channel blockers — relaxes blood vessels to ease blood flow and reduce blood pressure.", "Aspirin — helps prevent blood clots, particularly important for heart-related conditions.", "Statins — helps lower cholesterol levels to protect blood vessels over time."],
  "Anxiety": ["SSRIs (e.g., Escitalopram) — helps regulate mood-related brain chemistry, typically over several weeks.", "SNRIs (e.g., Duloxetine) — helps regulate mood-related brain chemistry, typically over several weeks.", "Benzodiazepines (short-term use) — used short-term for acute symptom relief due to dependency risk with longer use.", "Buspirone — a non-habit-forming option for longer-term anxiety management.", "Cognitive Behavioral Therapy (CBT) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Appendicitis": ["Surgical removal (Appendectomy) — removes or repairs the affected tissue when medication alone isn't enough.", "Pre-operative antibiotics (e.g., Ceftriaxone + Metronidazole) — targets bacterial infections specifically — it won't help a viral illness.", "Pain management — eases discomfort while the underlying issue is treated or resolves on its own.", "IV fluids — restores hydration and supports organ function during acute illness.", "NPO status before surgery — rests the digestive system so it isn't further irritated before or during treatment."],
  "Arthritis of the hip": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Corticosteroid injections — reduces inflammation but requires medical supervision for dosing and tapering.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Glucosamine supplements — a supplement some people use to support joint cartilage, though evidence is mixed.", "Hip replacement surgery (in advanced cases) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Asthma": ["Inhaled corticosteroids (e.g., Fluticasone) — reduces inflammation but requires medical supervision for dosing and tapering.", "Beta-agonists (e.g., Albuterol) — relaxes airway muscles to make breathing easier.", "Leukotriene modifiers (e.g., Montelukast) — blocks inflammatory chemicals that trigger airway narrowing.", "Anticholinergics (e.g., Ipratropium) — helps relax airway muscles, often used alongside other inhaled medications.", "Omalizumab — targets the antibody responsible for severe allergic asthma reactions."],
  "Benign prostatic hyperplasia (BPH)": ["Alpha blockers (e.g., Tamsulosin) — relaxes muscles around the bladder and prostate to ease urination.", "5-alpha reductase inhibitors (e.g., Finasteride) — used as directed by a healthcare provider based on severity and response.", "Tadalafil (for symptoms) — used as directed by a healthcare provider based on severity and response.", "Surgical options (e.g., TURP) — used as directed by a healthcare provider based on severity and response.", "Lifestyle changes — used as directed by a healthcare provider based on severity and response."],
  "Brachial neuritis": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Oral corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Gabapentin or Pregabalin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Pain management — eases discomfort while the underlying issue is treated or resolves on its own."],
  "Bursitis": ["NSAIDs (e.g., Ibuprofen) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Corticosteroid injections — reduces inflammation but requires medical supervision for dosing and tapering.", "Ice packs — used as directed by a healthcare provider based on severity and response.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Antibiotics (if septic bursitis) — targets bacterial infections specifically — it won't help a viral illness."],
  "Carpal tunnel syndrome": ["Wrist splint — used as directed by a healthcare provider based on severity and response.", "NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Corticosteroid injections — reduces inflammation but requires medical supervision for dosing and tapering.", "Gabapentin (if nerve pain) — calms overactive nerve signals that cause chronic or nerve-related pain.", "Surgical decompression (if severe) — used as directed by a healthcare provider based on severity and response."],
  "Cholecystitis": ["IV antibiotics (e.g., Ceftriaxone + Metronidazole) — targets bacterial infections specifically — it won't help a viral illness.", "Pain relievers (e.g., Morphine) — eases discomfort while the underlying issue is treated or resolves on its own.", "IV fluids — restores hydration and supports organ function during acute illness.", "NPO (nothing by mouth) — used as directed by a healthcare provider based on severity and response.", "Cholecystectomy (surgical removal of gallbladder) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Chronic back pain": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Epidural steroid injections — delivers anti-inflammatory or numbing medication directly to the source of pain.", "Chronic pain management (e.g., TENS, acupuncture) — eases discomfort while the underlying issue is treated or resolves on its own."],
  "Chronic constipation": ["Laxatives (e.g., Polyethylene glycol) — used as directed by a healthcare provider based on severity and response.", "Stool softeners (e.g., Docusate) — makes bowel movements easier and less painful without a harsh laxative effect.", "Fiber supplements (e.g., Psyllium) — used as directed by a healthcare provider based on severity and response.", "Osmotic agents (e.g., Lactulose) — used as directed by a healthcare provider based on severity and response.", "Prokinetics — used as directed by a healthcare provider based on severity and response."],
  "Chronic obstructive pulmonary disease (COPD)": ["Bronchodilators (e.g., Salbutamol) — relaxes airway muscles to make breathing easier.", "Inhaled corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Phosphodiesterase-4 inhibitors (e.g., Roflumilast) — used as directed by a healthcare provider based on severity and response.", "Oxygen therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Antibiotics during exacerbations — targets bacterial infections specifically — it won't help a viral illness."],
  "Common cold": ["Paracetamol — relieves pain and fever with less stomach irritation than NSAIDs.", "Ibuprofen — relieves pain and inflammation, but should be used at the lowest effective dose.", "Decongestants (e.g., Pseudoephedrine) — narrows swollen nasal blood vessels to relieve congestion.", "Antihistamines — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Cough syrups (e.g., Dextromethorphan) — reduces the urge to cough, most useful for a dry, disruptive cough."],
  "Complex regional pain syndrome": ["Gabapentin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Amitriptyline — calms overactive nerve signals that cause chronic or nerve-related pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Nerve blocks — delivers anti-inflammatory or numbing medication directly to the source of pain."],
  "Concussion": ["Rest — used as directed by a healthcare provider based on severity and response.", "Acetaminophen (avoid NSAIDs early) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Cognitive rest — used as directed by a healthcare provider based on severity and response.", "Hydration — restores fluid balance and supports the body's natural recovery processes.", "Gradual return to activities — used as directed by a healthcare provider based on severity and response."],
  "Conjunctivitis": ["Antibiotic eye drops (e.g., Erythromycin, Moxifloxacin) — targets bacterial infections specifically — it won't help a viral illness.", "Antiviral drops (e.g., Ganciclovir for herpes) — works specifically against the virus causing the infection, and works best started early.", "Lubricant drops — used as directed by a healthcare provider based on severity and response.", "Antihistamines (for allergic type) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Cool compresses — used as directed by a healthcare provider based on severity and response."],
  "Conjunctivitis due to allergy": ["Antihistamine eye drops (e.g., Olopatadine) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Mast cell stabilizers (e.g., Ketotifen) — used as directed by a healthcare provider based on severity and response.", "Artificial tears — used as directed by a healthcare provider based on severity and response.", "Oral antihistamines — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Cold compress — reduces swelling and numbs discomfort in the early stages."],
  "Contact dermatitis": ["Topical corticosteroids (e.g., Hydrocortisone) — reduces inflammation but requires medical supervision for dosing and tapering.", "Oral antihistamines — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Moisturizers — used as directed by a healthcare provider based on severity and response.", "Avoidance of allergen/irritant — used as directed by a healthcare provider based on severity and response.", "Oral corticosteroids (if severe) — reduces inflammation but requires medical supervision for dosing and tapering."],
  "Cornea infection": ["Antibiotic eye drops (e.g., Ciprofloxacin) — targets bacterial infections specifically — it won't help a viral illness.", "Antiviral eye drops (e.g., Ganciclovir) — works specifically against the virus causing the infection, and works best started early.", "Antifungal drops (e.g., Natamycin) — targets fungal infections and is usually continued for a set course even after symptoms improve.", "Lubricant eye drops — used as directed by a healthcare provider based on severity and response.", "Steroids (in selected cases) — used as directed by a healthcare provider based on severity and response."],
  "Croup": ["Dexamethasone (oral or IM) — used as directed by a healthcare provider based on severity and response.", "Nebulized epinephrine — reverses severe allergic reactions quickly and should be used at the first sign of anaphylaxis.", "Humidified air — used as directed by a healthcare provider based on severity and response.", "Antipyretics — brings down fever and eases the general discomfort that comes with it.", "Hydration — restores fluid balance and supports the body's natural recovery processes."],
  "Cystitis": ["Nitrofurantoin — an antibiotic that targets the specific bacteria causing the infection.", "Trimethoprim-sulfamethoxazole — an antibiotic that targets the specific bacteria causing the infection.", "Fosfomycin — used as directed by a healthcare provider based on severity and response.", "Phenazopyridine (for pain relief) — used as directed by a healthcare provider based on severity and response.", "Hydration — restores fluid balance and supports the body's natural recovery processes."],
  "Degenerative disc disease": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Steroid injections — delivers anti-inflammatory or numbing medication directly to the source of pain.", "Surgery (e.g., spinal fusion in advanced cases) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Dental caries": ["Fluoride toothpaste or gel — applied directly to the affected area to limit whole-body side effects.", "Dental fillings — used as directed by a healthcare provider based on severity and response.", "Chlorhexidine mouth rinse — used as directed by a healthcare provider based on severity and response.", "Analgesics for pain — eases discomfort while the underlying issue is treated or resolves on its own.", "Root canal therapy (if advanced) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Depression": ["SSRIs (e.g., Sertraline, Escitalopram) — helps regulate mood-related brain chemistry, typically over several weeks.", "SNRIs (e.g., Venlafaxine) — helps regulate mood-related brain chemistry, typically over several weeks.", "Atypical antidepressants (e.g., Bupropion) — helps regulate mood-related brain chemistry, typically over several weeks.", "Cognitive Behavioral Therapy (CBT) — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Psychotherapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Developmental disability": ["Speech therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Occupational therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Behavioral therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Medications (e.g., Risperidone for irritability in autism) — used as directed by a healthcare provider based on severity and response.", "Special education programs — used as directed by a healthcare provider based on severity and response."],
  "Diaper rash": ["Zinc oxide cream — applied directly to the affected area to limit whole-body side effects.", "Petroleum jelly — used as directed by a healthcare provider based on severity and response.", "Topical antifungals (e.g., Clotrimazole) — targets fungal infections and is usually continued for a set course even after symptoms improve.", "Hydrocortisone cream (short-term) — applied directly to the affected area to limit whole-body side effects.", "Frequent diaper changes — used as directed by a healthcare provider based on severity and response."],
  "Diverticulitis": ["Antibiotics (e.g., Ciprofloxacin + Metronidazole) — targets bacterial infections specifically — it won't help a viral illness.", "Clear liquid diet (during flare) — used as directed by a healthcare provider based on severity and response.", "Pain relievers — eases discomfort while the underlying issue is treated or resolves on its own.", "High-fiber diet (after recovery) — used as directed by a healthcare provider based on severity and response.", "Surgery (if complications) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Drug reaction": ["Discontinuation of offending drug — used as directed by a healthcare provider based on severity and response.", "Antihistamines (e.g., Diphenhydramine) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Epinephrine (for anaphylaxis) — reverses severe allergic reactions quickly and should be used at the first sign of anaphylaxis.", "IV fluids and supportive care — restores hydration and supports organ function during acute illness."],
  "Ear drum damage": ["Antibiotic ear drops (if infection) — targets bacterial infections specifically — it won't help a viral illness.", "Oral antibiotics (if needed) — targets bacterial infections specifically — it won't help a viral illness.", "Avoid water entry — used as directed by a healthcare provider based on severity and response.", "Pain relief (e.g., Acetaminophen) — relieves pain and fever with less stomach irritation than NSAIDs.", "Tympanoplasty (if persistent perforation) — used as directed by a healthcare provider based on severity and response."],
  "Eczema": ["Topical corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Emollients/Moisturizers — used as directed by a healthcare provider based on severity and response.", "Antihistamines (for itching) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Calcineurin inhibitors (e.g., Tacrolimus) — used as directed by a healthcare provider based on severity and response.", "Phototherapy (in severe cases) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Esophagitis": ["Proton Pump Inhibitors (e.g., Omeprazole) — reduces stomach acid production to relieve heartburn and protect the lining.", "H2 Blockers (e.g., Ranitidine) — reduces stomach acid to relieve heartburn, though generally milder than a PPI.", "Sucralfate — used as directed by a healthcare provider based on severity and response.", "Antifungal or antiviral agents (if infectious) — works specifically against the virus causing the infection, and works best started early.", "Dietary changes — used as directed by a healthcare provider based on severity and response."],
  "Eustachian tube dysfunction (ear disorder)": ["Nasal decongestants — narrows swollen nasal blood vessels to relieve congestion.", "Nasal corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Auto-inflation (e.g., Valsalva maneuver) — used as directed by a healthcare provider based on severity and response.", "Antihistamines — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Surgical placement of ear tubes (in severe cases) — used as directed by a healthcare provider based on severity and response."],
  "Fungal infection of the hair": ["Griseofulvin (oral) — used as directed by a healthcare provider based on severity and response.", "Terbinafine (oral) — used as directed by a healthcare provider based on severity and response.", "Ketoconazole shampoo — used as directed by a healthcare provider based on severity and response.", "Selenium sulfide shampoo — used as directed by a healthcare provider based on severity and response.", "Itraconazole — used as directed by a healthcare provider based on severity and response."],
  "Gallstone": ["Ursodeoxycholic acid (in some cases) — used as directed by a healthcare provider based on severity and response.", "Pain relievers (e.g., NSAIDs) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Cholecystectomy (surgical removal) — removes or repairs the affected tissue when medication alone isn't enough.", "Antibiotics (if cholecystitis) — targets bacterial infections specifically — it won't help a viral illness.", "Dietary modifications — used as directed by a healthcare provider based on severity and response."],
  "Gastrointestinal hemorrhage": ["IV proton pump inhibitors (e.g., Pantoprazole) — reduces stomach acid production to relieve heartburn and protect the lining.", "Endoscopic hemostasis — used as directed by a healthcare provider based on severity and response.", "Blood transfusion — used as directed by a healthcare provider based on severity and response.", "Octreotide (for variceal bleeding) — used as directed by a healthcare provider based on severity and response.", "Antibiotics (e.g., Ceftriaxone) if cirrhosis present — targets bacterial infections specifically — it won't help a viral illness."],
  "Gout": ["Colchicine — used as directed by a healthcare provider based on severity and response.", "NSAIDs (e.g., Indomethacin) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Allopurinol — used as directed by a healthcare provider based on severity and response.", "Febuxostat — used as directed by a healthcare provider based on severity and response.", "Corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering."],
  "Gum disease": ["Antibacterial mouthwash (e.g., Chlorhexidine) — used as directed by a healthcare provider based on severity and response.", "Scaling and root planing — used as directed by a healthcare provider based on severity and response.", "Doxycycline — used as directed by a healthcare provider based on severity and response.", "Fluoride toothpaste — used as directed by a healthcare provider based on severity and response.", "Surgical interventions (if severe) — used as directed by a healthcare provider based on severity and response."],
  "Heart attack": ["Aspirin — helps prevent blood clots, particularly important for heart-related conditions.", "Nitroglycerin — widens blood vessels quickly to relieve chest pain during an episode.", "Beta-blockers (e.g., Metoprolol) — slows the heart rate and reduces its workload.", "ACE inhibitors — relaxes blood vessels and reduces the heart's workload.", "Thrombolytics or PCI (percutaneous coronary intervention) — used as directed by a healthcare provider based on severity and response."],
  "Heart failure": ["ACE inhibitors — relaxes blood vessels and reduces the heart's workload.", "Beta-blockers — slows the heart rate and reduces its workload.", "Loop diuretics (e.g., Furosemide) — helps the body eliminate excess fluid, reducing swelling and strain on the heart.", "Aldosterone antagonists (e.g., Spironolactone) — used as directed by a healthcare provider based on severity and response.", "Digoxin (in some cases) — used as directed by a healthcare provider based on severity and response."],
  "Hemorrhoids": ["Topical hydrocortisone cream — applied directly to the affected area to limit whole-body side effects.", "Witch hazel pads — used as directed by a healthcare provider based on severity and response.", "Stool softeners (e.g., Docusate) — makes bowel movements easier and less painful without a harsh laxative effect.", "Sitz baths — soothes the area and promotes healing with warm, clean water.", "Surgical procedures (e.g., rubber band ligation) — used as directed by a healthcare provider based on severity and response."],
  "Herniated disk": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Steroid injections — delivers anti-inflammatory or numbing medication directly to the source of pain.", "Surgical discectomy (if severe) — used as directed by a healthcare provider based on severity and response."],
  "Hiatal hernia": ["Antacids — neutralizes stomach acid quickly for short-term heartburn relief.", "Proton Pump Inhibitors (e.g., Omeprazole) — reduces stomach acid production to relieve heartburn and protect the lining.", "H2 Blockers (e.g., Ranitidine) — reduces stomach acid to relieve heartburn, though generally milder than a PPI.", "Prokinetic agents — used as directed by a healthcare provider based on severity and response.", "Surgery (in severe cases) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Hyperemesis gravidarum": ["IV fluids and electrolytes — restores hydration and supports organ function during acute illness.", "Vitamin B6 (Pyridoxine) — used as directed by a healthcare provider based on severity and response.", "Antiemetics (e.g., Ondansetron, Promethazine) — controls nausea and vomiting so fluids and nutrition can be kept down.", "Thiamine supplementation — used as directed by a healthcare provider based on severity and response.", "Nutritional support (e.g., TPN if severe) — used as directed by a healthcare provider based on severity and response."],
  "Hypertensive heart disease": ["ACE inhibitors (e.g., Lisinopril) — relaxes blood vessels and reduces the heart's workload.", "Beta-blockers (e.g., Metoprolol) — slows the heart rate and reduces its workload.", "Diuretics (e.g., Furosemide) — helps the body eliminate excess fluid, reducing swelling and strain on the heart.", "Calcium channel blockers (e.g., Amlodipine) — relaxes blood vessels to ease blood flow and reduce blood pressure.", "Lifestyle modification — addresses the everyday habits that most directly affect this condition's course."],
  "Hypoglycemia": ["Glucose tablets — used as directed by a healthcare provider based on severity and response.", "Juice or sugary snacks — used as directed by a healthcare provider based on severity and response.", "Glucagon injection (emergency) — used as directed by a healthcare provider based on severity and response.", "Adjust insulin or diabetes medication — directly replaces or supplements the body's own blood-sugar-regulating hormone.", "Frequent meals — used as directed by a healthcare provider based on severity and response."],
  "Idiopathic excessive menstruation": ["Tranexamic acid — used as directed by a healthcare provider based on severity and response.", "NSAIDs (e.g., Mefenamic acid) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Oral contraceptives — can help regulate hormone-related symptoms alongside its primary use.", "Levonorgestrel-releasing IUD — used as directed by a healthcare provider based on severity and response.", "Iron supplements — replenishes nutrients the body needs to make healthy blood cells."],
  "Idiopathic irregular menstrual cycle": ["Combined oral contraceptives — can help regulate hormone-related symptoms alongside its primary use.", "Progestins — used as directed by a healthcare provider based on severity and response.", "Metformin (if PCOS-related) — helps the body use insulin more effectively to control blood sugar.", "Lifestyle modification — addresses the everyday habits that most directly affect this condition's course.", "Clomiphene (for ovulation induction) — used as directed by a healthcare provider based on severity and response."],
  "Idiopathic painful menstruation": ["NSAIDs (e.g., Ibuprofen) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Oral contraceptives — can help regulate hormone-related symptoms alongside its primary use.", "Heat therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Vitamin B1 and magnesium supplements — used as directed by a healthcare provider based on severity and response.", "Physical activity — used as directed by a healthcare provider based on severity and response."],
  "Infectious gastroenteritis": ["Oral rehydration salts (ORS) — restores fluid balance and supports the body's natural recovery processes.", "Antibiotics (e.g., Ciprofloxacin, if bacterial) — targets bacterial infections specifically — it won't help a viral illness.", "Antiemetics (e.g., Ondansetron) — controls nausea and vomiting so fluids and nutrition can be kept down.", "Probiotics — helps restore healthy gut bacteria, especially after illness or antibiotics.", "Loperamide (if appropriate) — slows bowel movements to reduce fluid loss during acute diarrhea."],
  "Injury to the arm": ["Pain relievers (e.g., Acetaminophen) — relieves pain and fever with less stomach irritation than NSAIDs.", "Cold compress — reduces swelling and numbs discomfort in the early stages.", "Immobilization/splinting — used as directed by a healthcare provider based on severity and response.", "Antibiotics (if open wound) — targets bacterial infections specifically — it won't help a viral illness.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Injury to the leg": ["Pain relievers — eases discomfort while the underlying issue is treated or resolves on its own.", "Compression bandages — used as directed by a healthcare provider based on severity and response.", "Crutches or brace — used as directed by a healthcare provider based on severity and response.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Antibiotics (if open wound) — targets bacterial infections specifically — it won't help a viral illness."],
  "Injury to the trunk": ["Pain relievers (e.g., Ibuprofen) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Ice/heat therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Wound care (if external) — used as directed by a healthcare provider based on severity and response.", "Physiotherapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Liver disease": ["Lactulose (for hepatic encephalopathy) — used as directed by a healthcare provider based on severity and response.", "Diuretics (e.g., Spironolactone) — helps the body eliminate excess fluid, reducing swelling and strain on the heart.", "Vitamin K (if coagulopathy) — used as directed by a healthcare provider based on severity and response.", "Ursodeoxycholic acid — used as directed by a healthcare provider based on severity and response.", "Antivirals (e.g., Tenofovir for HBV) — works specifically against the virus causing the infection, and works best started early."],
  "Macular degeneration": ["Anti-VEGF injections (e.g., Ranibizumab, Aflibercept) — used as directed by a healthcare provider based on severity and response.", "AREDS2 vitamin supplements — used as directed by a healthcare provider based on severity and response.", "Photodynamic therapy — uses a light-activated compound to target damaged cells with minimal effect on surrounding tissue.", "Laser therapy (rarely) — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Low vision aids — used as directed by a healthcare provider based on severity and response."],
  "Marijuana abuse": ["Behavioral therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "CBT — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Motivational enhancement therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "No FDA-approved medications — used as directed by a healthcare provider based on severity and response.", "Support groups (e.g., NA) — used as directed by a healthcare provider based on severity and response."],
  "Multiple sclerosis": ["Interferon beta — used as directed by a healthcare provider based on severity and response.", "Glatiramer acetate — used as directed by a healthcare provider based on severity and response.", "Natalizumab — used as directed by a healthcare provider based on severity and response.", "Corticosteroids (for flare-ups) — reduces inflammation but requires medical supervision for dosing and tapering.", "Disease-modifying therapies (e.g., Fingolimod) — used as directed by a healthcare provider based on severity and response."],
  "Noninfectious gastroenteritis": ["Antiemetics (e.g., Ondansetron) — controls nausea and vomiting so fluids and nutrition can be kept down.", "Antispasmodics (e.g., Dicyclomine) — used as directed by a healthcare provider based on severity and response.", "Probiotics — helps restore healthy gut bacteria, especially after illness or antibiotics.", "Hydration therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Dietary changes (BRAT diet) — used as directed by a healthcare provider based on severity and response."],
  "Nose disorder": ["Nasal decongestants (e.g., Oxymetazoline) — narrows swollen nasal blood vessels to relieve congestion.", "Antihistamines — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Saline nasal spray — rinses and moistens nasal passages to loosen congestion.", "Intranasal corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Antibiotics (if bacterial infection) — targets bacterial infections specifically — it won't help a viral illness."],
  "Obstructive sleep apnea (OSA)": ["CPAP (Continuous Positive Airway Pressure) — used as directed by a healthcare provider based on severity and response.", "Weight loss — used as directed by a healthcare provider based on severity and response.", "Mandibular advancement device — used as directed by a healthcare provider based on severity and response.", "Modafinil (for residual sleepiness) — used as directed by a healthcare provider based on severity and response.", "Surgery (e.g., UPPP, if indicated) — removes or repairs the affected tissue when medication alone isn't enough."],
  "Otitis externa (swimmer's ear)": ["Topical antibiotic ear drops (e.g., Ciprofloxacin + Hydrocortisone) — targets bacterial infections specifically — it won't help a viral illness.", "Acidifying drops (e.g., Acetic acid) — used as directed by a healthcare provider based on severity and response.", "Analgesics — eases discomfort while the underlying issue is treated or resolves on its own.", "Ear wick for deep infections — used as directed by a healthcare provider based on severity and response.", "Avoid water exposure — used as directed by a healthcare provider based on severity and response."],
  "Otitis media": ["Amoxicillin — an antibiotic that targets the specific bacteria causing the infection.", "Cefdinir — used as directed by a healthcare provider based on severity and response.", "Acetaminophen for pain — relieves pain and fever with less stomach irritation than NSAIDs.", "Decongestants — narrows swollen nasal blood vessels to relieve congestion.", "Tympanostomy (if recurrent) — used as directed by a healthcare provider based on severity and response."],
  "Pain after an operation": ["Acetaminophen — relieves pain and fever with less stomach irritation than NSAIDs.", "Opioids (e.g., Morphine, Tramadol) — used as directed by a healthcare provider based on severity and response.", "NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Local anesthetics — used as directed by a healthcare provider based on severity and response.", "Nerve blocks — delivers anti-inflammatory or numbing medication directly to the source of pain."],
  "Panic disorder": ["SSRIs (e.g., Sertraline, Fluoxetine) — helps regulate mood-related brain chemistry, typically over several weeks.", "Benzodiazepines (e.g., Clonazepam, Alprazolam) — used short-term for acute symptom relief due to dependency risk with longer use.", "SNRIs (e.g., Venlafaxine) — helps regulate mood-related brain chemistry, typically over several weeks.", "Beta-blockers — slows the heart rate and reduces its workload.", "Cognitive Behavioral Therapy (CBT) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Pelvic inflammatory disease": ["Ceftriaxone + Doxycycline + Metronidazole — used as directed by a healthcare provider based on severity and response.", "Pain relievers — eases discomfort while the underlying issue is treated or resolves on its own.", "Hospitalization (for severe cases) — used as directed by a healthcare provider based on severity and response.", "Partner treatment — used as directed by a healthcare provider based on severity and response.", "Abstain from intercourse during treatment — used as directed by a healthcare provider based on severity and response."],
  "Peripheral nerve disorder": ["Gabapentin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Pregabalin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Amitriptyline — calms overactive nerve signals that cause chronic or nerve-related pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Alpha-lipoic acid (as supplement) — used as directed by a healthcare provider based on severity and response."],
  "Personality disorder": ["Psychotherapy (e.g., DBT for BPD) — helps address the thought patterns and habits that feed the condition, alongside any medication.", "SSRIs (for mood symptoms) — helps regulate mood-related brain chemistry, typically over several weeks.", "Mood stabilizers (e.g., Lithium) — used as directed by a healthcare provider based on severity and response.", "Antipsychotics (in some cases) — used as directed by a healthcare provider based on severity and response.", "Group therapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Pneumonia": ["Antibiotics (e.g., Azithromycin, Ceftriaxone) — targets bacterial infections specifically — it won't help a viral illness.", "Antivirals (e.g., Oseltamivir if viral) — works specifically against the virus causing the infection, and works best started early.", "Expectorants — helps loosen and thin mucus so it's easier to clear.", "Fever reducers (e.g., Acetaminophen) — relieves pain and fever with less stomach irritation than NSAIDs.", "Oxygen therapy if needed — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Problem during pregnancy": ["Prenatal vitamins — used as directed by a healthcare provider based on severity and response.", "Iron supplements — replenishes nutrients the body needs to make healthy blood cells.", "Antihypertensives (e.g., Labetalol) — lowers blood pressure to reduce strain on the heart and blood vessels.", "Insulin (for gestational diabetes) — directly replaces or supplements the body's own blood-sugar-regulating hormone.", "Folic acid — replenishes nutrients the body needs to make healthy blood cells."],
  "Psoriasis": ["Topical corticosteroids — reduces inflammation but requires medical supervision for dosing and tapering.", "Vitamin D analogs (e.g., Calcipotriol) — used as directed by a healthcare provider based on severity and response.", "Methotrexate — used as directed by a healthcare provider based on severity and response.", "Biologics (e.g., Adalimumab) — used as directed by a healthcare provider based on severity and response.", "Phototherapy (UVB) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Pyogenic skin infection": ["Oral antibiotics (e.g., Cephalexin, Clindamycin) — targets bacterial infections specifically — it won't help a viral illness.", "Topical antibiotics (e.g., Mupirocin) — targets bacterial infections specifically — it won't help a viral illness.", "Incision and drainage — used as directed by a healthcare provider based on severity and response.", "Antiseptic cleansing — used as directed by a healthcare provider based on severity and response.", "Pain management — eases discomfort while the underlying issue is treated or resolves on its own."],
  "Rectal disorder": ["Hydrocortisone suppositories — used as directed by a healthcare provider based on severity and response.", "Laxatives (e.g., Lactulose) — used as directed by a healthcare provider based on severity and response.", "Fiber supplements — used as directed by a healthcare provider based on severity and response.", "Sitz baths — soothes the area and promotes healing with warm, clean water.", "Surgical intervention (e.g., hemorrhoidectomy if needed) — used as directed by a healthcare provider based on severity and response."],
  "Schizophrenia": ["Antipsychotics (e.g., Risperidone, Olanzapine) — used as directed by a healthcare provider based on severity and response.", "Clozapine (treatment-resistant cases) — used as directed by a healthcare provider based on severity and response.", "Cognitive behavioral therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Long-acting injectables — used as directed by a healthcare provider based on severity and response.", "Psychosocial support — used as directed by a healthcare provider based on severity and response."],
  "Seasonal allergies (hay fever)": ["Oral antihistamines (e.g., Cetirizine) — blocks histamine to relieve itching, sneezing, and allergic swelling.", "Intranasal corticosteroids (e.g., Fluticasone) — reduces inflammation but requires medical supervision for dosing and tapering.", "Leukotriene receptor antagonists (e.g., Montelukast) — blocks inflammatory chemicals that trigger airway narrowing.", "Nasal saline rinses — used as directed by a healthcare provider based on severity and response.", "Allergy immunotherapy — gradually retrains the immune system to tolerate the allergen over time."],
  "Sebaceous cyst": ["Warm compress — improves blood flow and loosens congestion or tension.", "Incision and drainage (if infected) — used as directed by a healthcare provider based on severity and response.", "Antibiotics (if signs of infection) — targets bacterial infections specifically — it won't help a viral illness.", "Surgical excision — used as directed by a healthcare provider based on severity and response.", "Steroid injection (if inflamed) — delivers anti-inflammatory or numbing medication directly to the source of pain."],
  "Sepsis": ["IV broad-spectrum antibiotics (e.g., Piperacillin-tazobactam) — targets bacterial infections specifically — it won't help a viral illness.", "IV fluids — restores hydration and supports organ function during acute illness.", "Vasopressors (e.g., Norepinephrine) — reverses severe allergic reactions quickly and should be used at the first sign of anaphylaxis.", "Oxygen therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Source control (e.g., drainage of abscess) — used as directed by a healthcare provider based on severity and response."],
  "Sickle cell crisis": ["Hydroxyurea — used as directed by a healthcare provider based on severity and response.", "Folic acid — replenishes nutrients the body needs to make healthy blood cells.", "Pain management (e.g., Morphine) — eases discomfort while the underlying issue is treated or resolves on its own.", "IV fluids — restores hydration and supports organ function during acute illness.", "Blood transfusions (if needed) — used as directed by a healthcare provider based on severity and response."],
  "Sinus bradycardia": ["Atropine (acute cases) — used as directed by a healthcare provider based on severity and response.", "Temporary or permanent pacemaker (if symptomatic) — used as directed by a healthcare provider based on severity and response.", "Adjust medications (if drug-induced) — used as directed by a healthcare provider based on severity and response.", "Isoproterenol infusion (if needed) — used as directed by a healthcare provider based on severity and response.", "Monitor ECG — used as directed by a healthcare provider based on severity and response."],
  "Skin pigmentation disorder": ["Hydroquinone cream — applied directly to the affected area to limit whole-body side effects.", "Topical retinoids — applied directly to the affected area to limit whole-body side effects.", "Azelaic acid — used as directed by a healthcare provider based on severity and response.", "Chemical peels — used as directed by a healthcare provider based on severity and response.", "Laser therapy (for resistant cases) — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Skin polyp": ["Cryotherapy — freezes abnormal tissue so healthy skin can regenerate in its place.", "Electrosurgical removal — removes or repairs the affected tissue when medication alone isn't enough.", "Snare excision — used as directed by a healthcare provider based on severity and response.", "Topical anesthesia — applied directly to the affected area to limit whole-body side effects.", "Histopathology (to rule out malignancy) — used as directed by a healthcare provider based on severity and response."],
  "Spinal stenosis": ["NSAIDs — relieves pain and inflammation, but should be used at the lowest effective dose.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Epidural steroid injections — delivers anti-inflammatory or numbing medication directly to the source of pain.", "Gabapentin or Pregabalin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Surgical decompression (e.g., laminectomy) — used as directed by a healthcare provider based on severity and response."],
  "Spondylosis": ["NSAIDs (e.g., Naproxen) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Epidural steroid injections — delivers anti-inflammatory or numbing medication directly to the source of pain.", "Surgery in severe cases — removes or repairs the affected tissue when medication alone isn't enough."],
  "Spontaneous abortion": ["Misoprostol (to complete expulsion) — used as directed by a healthcare provider based on severity and response.", "Mifepristone + Misoprostol (in selected cases) — used as directed by a healthcare provider based on severity and response.", "Dilation and curettage (if needed) — used as directed by a healthcare provider based on severity and response.", "Rh immunoglobulin (if Rh-negative) — used as directed by a healthcare provider based on severity and response.", "Emotional support and counseling — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Sprain or strain": ["RICE (Rest, Ice, Compression, Elevation) — used as directed by a healthcare provider based on severity and response.", "NSAIDs (e.g., Ibuprofen) — relieves pain and inflammation, but should be used at the lowest effective dose.", "Muscle relaxants — eases muscle spasm and tension that can worsen pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Immobilization (if needed) — used as directed by a healthcare provider based on severity and response."],
  "Strep throat": ["Penicillin — used as directed by a healthcare provider based on severity and response.", "Amoxicillin — an antibiotic that targets the specific bacteria causing the infection.", "Azithromycin (if allergic to penicillin) — used as directed by a healthcare provider based on severity and response.", "Analgesics (e.g., Acetaminophen) — relieves pain and fever with less stomach irritation than NSAIDs.", "Salt water gargles — used as directed by a healthcare provider based on severity and response."],
  "Stye": ["Warm compresses — improves blood flow and loosens congestion or tension.", "Topical antibiotic ointment (e.g., Erythromycin) — targets bacterial infections specifically — it won't help a viral illness.", "Oral antibiotics (if spreading) — targets bacterial infections specifically — it won't help a viral illness.", "Pain relievers — eases discomfort while the underlying issue is treated or resolves on its own.", "Incision and drainage (if abscess forms) — used as directed by a healthcare provider based on severity and response."],
  "Temporary or benign blood in urine": ["Hydration therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Avoid strenuous exercise — used as directed by a healthcare provider based on severity and response.", "Adjust anticoagulants (if relevant) — used as directed by a healthcare provider based on severity and response.", "Monitor kidney function — used as directed by a healthcare provider based on severity and response.", "Reassurance and follow-up — used as directed by a healthcare provider based on severity and response."],
  "Threatened pregnancy": ["Progesterone supplements — used as directed by a healthcare provider based on severity and response.", "Folic acid — replenishes nutrients the body needs to make healthy blood cells.", "Bed rest (limited use) — used as directed by a healthcare provider based on severity and response.", "IV fluids (if dehydrated) — restores hydration and supports organ function during acute illness.", "Close monitoring with ultrasound — used as directed by a healthcare provider based on severity and response."],
  "Urinary tract infection": ["Nitrofurantoin — an antibiotic that targets the specific bacteria causing the infection.", "Ciprofloxacin — used as directed by a healthcare provider based on severity and response.", "Trimethoprim-sulfamethoxazole — an antibiotic that targets the specific bacteria causing the infection.", "Cranberry supplements — used as directed by a healthcare provider based on severity and response.", "Hydration therapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
  "Vaginal cyst": ["Warm compress — improves blood flow and loosens congestion or tension.", "Sitz bath — soothes the area and promotes healing with warm, clean water.", "Antibiotics (if infected) — targets bacterial infections specifically — it won't help a viral illness.", "Surgical drainage (if large or recurrent) — used as directed by a healthcare provider based on severity and response.", "Analgesics for pain — eases discomfort while the underlying issue is treated or resolves on its own."],
  "Vaginitis": ["Metronidazole — used as directed by a healthcare provider based on severity and response.", "Clindamycin — used as directed by a healthcare provider based on severity and response.", "Fluconazole — used as directed by a healthcare provider based on severity and response.", "Hydrocortisone cream — applied directly to the affected area to limit whole-body side effects.", "Probiotic supplements — helps restore healthy gut bacteria, especially after illness or antibiotics."],
  "Vulvodynia": ["Topical Lidocaine — applied directly to the affected area to limit whole-body side effects.", "Tricyclic antidepressants (e.g., Amitriptyline) — calms overactive nerve signals that cause chronic or nerve-related pain.", "Gabapentin — calms overactive nerve signals that cause chronic or nerve-related pain.", "Physical therapy — helps address the thought patterns and habits that feed the condition, alongside any medication.", "Cognitive behavioral therapy — helps address the thought patterns and habits that feed the condition, alongside any medication."],
};

const HOME_TREATMENT_DB = {
  "Vaginitis": "Most people manage vaginitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your pain during intercourse, lower abdominal pain, or vaginal pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gynecology rather than waiting it out.",
  "Acute sinusitis": "Most people manage acute sinusitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your sore throat, coryza, or sinus congestion change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in ENT rather than waiting it out.",
  "Bursitis": "Most people manage bursitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your elbow swelling, knee pain, or hip pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Orthopedics rather than waiting it out.",
  "Actinic keratosis": "Most people manage actinic keratosis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your symptoms of the face, irregular appearing scalp, or skin dryness, peeling, scaliness, or roughness change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Spondylosis": "Most people manage spondylosis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your neck pain, low back pain, or ache all over change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Orthopedics rather than waiting it out.",
  "Vulvodynia": "Most people manage vulvodynia entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your back pain, vaginal discharge, or lower abdominal pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gynecology rather than waiting it out.",
  "Allergy": "Most people manage allergy entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your fluid retention, peripheral edema, or allergic reaction change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Allergy & Immunology rather than waiting it out.",
  "Otitis media": "Most people manage otitis media entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your vomiting, ear pain, or coryza change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in ENT rather than waiting it out.",
  "Gum disease": "Most people manage gum disease entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your mouth ulcer, toothache, or ear pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dentistry rather than waiting it out.",
  "Conjunctivitis due to allergy": "Most people manage conjunctivitis due to allergy entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your eye redness, sneezing, or itchiness of eye change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Ophthalmology rather than waiting it out.",
  "Vaginal cyst": "Most people manage vaginal cyst entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your heavy menstrual flow, pelvic pain, or lower abdominal pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gynecology rather than waiting it out.",
  "Carpal tunnel syndrome": "Most people manage carpal tunnel syndrome entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your elbow pain, loss of sensation, or wrist swelling change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Orthopedics rather than waiting it out.",
  "Nose disorder": "Most people manage nose disorder entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your ear pain, nosebleed, or facial pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in ENT rather than waiting it out.",
  "Dental caries": "Most people manage dental caries entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your facial pain, peripheral edema, or restlessness change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dentistry rather than waiting it out.",
  "Seasonal allergies (hay fever)": "Most people manage seasonal allergies (hay fever) entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your lacrimation, ear pain, or frontal headache change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Allergy & Immunology rather than waiting it out.",
  "Fungal infection of the hair": "Most people manage fungal infection of the hair entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin growth, skin rash, or pelvic pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Stye": "Most people manage stye entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin swelling, eyelid lesion or rash, or swollen eye change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Ophthalmology rather than waiting it out.",
  "Psoriasis": "Most people manage psoriasis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin swelling, skin rash, or irregular appearing scalp change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Otitis externa (swimmer's ear)": "Most people manage otitis externa (swimmer's ear) entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your itchy ear(s), fever, or ear pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in ENT rather than waiting it out.",
  "Acute bronchitis": "Most people manage acute bronchitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your nasal congestion, fever, or coryza change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Pulmonology rather than waiting it out.",
  "Common cold": "Most people manage common cold entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your chills, ear pain, or headache change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in General Practice rather than waiting it out.",
  "Idiopathic irregular menstrual cycle": "Most people manage idiopathic irregular menstrual cycle entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your cramps and spasms, long menstrual periods, or heavy menstrual flow change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gynecology rather than waiting it out.",
  "Hemorrhoids": "Most people manage hemorrhoids entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your heartburn, lower body pain, or rectal bleeding change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Colorectal Surgery rather than waiting it out.",
  "Contact dermatitis": "Most people manage contact dermatitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin moles, allergic reaction, or itching of skin change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Chronic constipation": "Most people manage chronic constipation entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your retention of urine, vomiting, or lower abdominal pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gastroenterology rather than waiting it out.",
  "Skin polyp": "Most people manage skin polyp entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin swelling, skin moles, or warts change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Sprain or strain": "Most people manage sprain or strain entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your back pain, arm pain, or wrist pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Orthopedics rather than waiting it out.",
  "Idiopathic painful menstruation": "Most people manage idiopathic painful menstruation entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your vaginal discharge, pelvic pain, or cramps and spasms change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Gynecology rather than waiting it out.",
  "Eustachian tube dysfunction (ear disorder)": "Most people manage eustachian tube dysfunction (ear disorder) entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your sore throat, abnormal breathing sounds, or ringing in ear change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in ENT rather than waiting it out.",
  "Sebaceous cyst": "Most people manage sebaceous cyst entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your skin moles, skin growth, or hand or finger lump or mass change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Skin pigmentation disorder": "Most people manage skin pigmentation disorder entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your irregular appearing scalp, warts, or skin growth change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
  "Chronic back pain": "Most people manage chronic back pain entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your back cramps or spasms, side pain, or low back pain change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Orthopedics rather than waiting it out.",
  "Conjunctivitis": "Most people manage conjunctivitis entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your sore throat, pain in eye, or coryza change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Ophthalmology rather than waiting it out.",
  "Diaper rash": "Most people manage diaper rash entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your temper problems, skin rash, or diaper rash change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Pediatrics / Dermatology rather than waiting it out.",
  "Eczema": "Most people manage eczema entirely at home, without needing prescription treatment. Follow the care steps, diet, and activity guidance below consistently for the first few days — that's usually enough time to notice steady improvement. Keep an eye on how your itching of skin, skin lesion, or acne or pimples change day to day; a gradual easing is the expected pattern. If symptoms haven't started improving within about a week, get noticeably worse, or you develop a high fever, spreading pain, or difficulty breathing, that's your signal to stop self-managing and get evaluated in Dermatology rather than waiting it out.",
};

function getHomeTreatment(diseaseName) {
  return HOME_TREATMENT_DB[diseaseName] || null;
}

function formatSymptom(s) {
  return s.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPrecautions(diseaseName) {
  return PRECAUTIONS_DB[diseaseName] || null;
}
function getDiet(diseaseName) {
  return DIETS_DB[diseaseName] || null;
}
function getWorkout(diseaseName) {
  return WORKOUTS_DB[diseaseName] || null;
}
function getMedications(diseaseName) {
  return MEDICATIONS_DB[diseaseName] || null;
}

/* =========================================================================
   AI ENGINE
   ========================================================================= */

/**
 * Dynamic Symptom Probability Matching.
 * Percentage for a given disease = (matched user symptoms / total symptoms defined
 * for that disease) * 100. Each disease's percentage is independent — it is NOT
 * renormalized against the other candidates, so scores reflect "how much of this
 * specific condition's symptom profile do you match" rather than a probability
 * distribution across diseases.
 *
 *   Common Cold  -> symptoms: [cough, sore_throat, fever, headache, runny_nose] (5 total)
 *                   user selects 4 of them -> (4/5)*100 = 80%
 *   GERD         -> symptoms: [heartburn, regurgitation, chest_pain, cough, hoarseness, globus] (6 total)
 *                   user selects only "cough" -> (1/6)*100 ≈ 17%
 *   Normal Cough -> symptoms: [cough] (1 total)
 *                   user selects "cough" -> (1/1)*100 = 100%
 */
function formatPercent(n) {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

function analyzeSymptoms(userSymptoms) {
  if (userSymptoms.length === 0) return [];
  const results = [];

  for (const disease of DISEASE_DB) {
    const diseaseSet = new Set(disease.symptoms.map((s) => s.trim()));
    const matched = userSymptoms.filter((s) => diseaseSet.has(s.trim()));
    if (matched.length === 0) continue;

    const totalDefined = disease.symptoms.length;
    const percentage = (matched.length / totalDefined) * 100; // kept unrounded for precise display (e.g. 33.33%)

    results.push({
      disease,
      probability: percentage,
      matchedSymptoms: matched,
      matchScore: percentage, // kept for sort compatibility
    });
  }

  if (results.length === 0) return [];

  // Sort by percentage match (desc), tie-break by raw matched count (desc)
  return results
    .sort((a, b) => b.probability - a.probability || b.matchedSymptoms.length - a.matchedSymptoms.length)
    .slice(0, 5);
}

function determinePrimaryTriage(results) {
  if (results.length === 0) return "yellow";
  const top = results[0];
  if (top.disease.triage === "red" && top.probability >= 30) return "red";
  if (top.disease.triage === "red" && top.probability >= 15) return "yellow";
  return top.disease.triage;
}

/* =========================================================================
   AUTHENTICATION — phone number + OTP, backed by the real ai-heart-backend
   (see backend/README.md for the full API contract). One account per
   phone number; the backend enforces this at the database level.
   ========================================================================= */

function PhoneAuthStep({ onOtpRequested }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!phone.trim()) { setError("Please enter your phone number."); return; }
    setLoading(true);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register" ? { phoneNumber: phone, language: "en" } : { phoneNumber: phone };
      const result = await apiFetch(path, { method: "POST", body });
      onOtpRequested({
        phoneNumber: result.phoneNumber,
        purpose: mode,
        devCode: result.devCode,
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (err) {
      if (err.code === "phone_already_registered") {
        setError("This number already has an account — switched you to login. Just submit again.");
        setMode("login");
      } else if (err.code === "phone_not_registered") {
        setError("No account found for this number — switched you to registration. Just submit again.");
        setMode("register");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#f1f5f9" }}>Welcome to AI-HeaRT</h1>
        <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
          Enter your phone number to {mode === "register" ? "create an account" : "log in"}. We'll text you a one-time code.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "#0a1628" }}>
        {["login", "register"].map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: mode === m ? "rgba(59,130,246,0.15)" : "transparent",
              color: mode === m ? "#60a5fa" : "#475569",
              border: mode === m ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
            }}>
            {m === "login" ? "Log In" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl p-6 mb-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
          <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: "#475569" }}>Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="012 345 678 or +855 12 345 678"
            className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
          />
          <p className="mt-2 text-xs" style={{ color: "#334155" }}>Cambodian mobile numbers — any common format works.</p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "white" }}>
          {loading ? "Sending code…" : mode === "register" ? "Send Verification Code →" : "Send Login Code →"}
        </button>
      </form>
    </div>
  );
}

function OtpStep({ pending, onVerified, onBack }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(pending.expiresInSeconds || 300);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const result = await apiFetch("/api/auth/verify", {
        method: "POST",
        body: { phoneNumber: pending.phoneNumber, code: code.trim(), purpose: pending.purpose },
      });
      onVerified(result.patient, result.session.token);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#f1f5f9" }}>Enter your code</h1>
        <p className="text-sm" style={{ color: "#64748b" }}>We sent a 6-digit code to {pending.phoneNumber}</p>
      </div>

      {pending.devCode && (
        <div className="mb-5 p-3.5 rounded-xl text-sm text-center" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
          🧪 Dev mode — no real SMS sent. Your code is <strong style={{ letterSpacing: "0.1em" }}>{pending.devCode}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl p-6 mb-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="w-full px-4 py-4 rounded-xl text-center text-2xl font-bold tracking-[0.5em] outline-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
          />
          <p className="mt-3 text-xs text-center" style={{ color: "#334155" }}>
            {secondsLeft > 0 ? `Code expires in ${mm}:${ss}` : "Code expired — go back and request a new one."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "white" }}>
          {loading ? "Verifying…" : "Verify & Continue →"}
        </button>
      </form>
    </div>
  );
}

/* =========================================================================
   PROFILE SETUP
   ========================================================================= */

function ProfileSetup({ onNext, initialValues, submitting, submitError }) {
  const [form, setForm] = useState({
    name: initialValues?.name || "",
    age: initialValues?.age || "",
    gender: initialValues?.gender || "",
    weight: initialValues?.weight || "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.age || isNaN(Number(form.age)) || Number(form.age) < 1) e.age = "Valid age required";
    if (!form.gender) e.gender = "Please select gender";
    if (!form.weight || isNaN(Number(form.weight)) || Number(form.weight) < 1) e.weight = "Valid weight required";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onNext(form);
  };

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const inputStyle = (hasError) => ({
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${hasError ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: "#e2e8f0",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 sm:mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-sm font-medium"
          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          {initialValues?.name ? "Update your profile" : "Almost there"}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight" style={{ color: "#f1f5f9" }}>
          Tell us about<br />
          <span style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>yourself</span>
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#64748b" }}>
          Your profile helps our AI provide more accurate health triage and personalized recommendations. This is saved to your account.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl p-5 sm:p-8 mb-6" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Full Name" error={errors.name} className="sm:col-span-2">
              <input value={form.name} onChange={set("name")} placeholder="e.g. Ahmad Raza"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none" style={inputStyle(!!errors.name)} />
            </Field>
            <Field label="Age (years)" error={errors.age}>
              <input type="number" value={form.age} onChange={set("age")} placeholder="28" min="1" max="120"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none" style={inputStyle(!!errors.age)} />
            </Field>
            <Field label="Weight (kg)" error={errors.weight}>
              <input type="number" value={form.weight} onChange={set("weight")} placeholder="68" min="1" max="300"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none" style={inputStyle(!!errors.weight)} />
            </Field>
            <Field label="Gender" error={errors.gender} className="sm:col-span-2">
              <div className="flex gap-3">
                {["Male", "Female", "Other"].map((g) => (
                  <button key={g} type="button"
                    onClick={() => { setForm((f) => ({ ...f, gender: g })); setErrors((e) => ({ ...e, gender: undefined })); }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: form.gender === g ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.03)",
                      color: form.gender === g ? "#60a5fa" : "#64748b",
                      border: form.gender === g ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    }}>
                    {g}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {submitError && (
          <div className="mb-4 p-3.5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
            {submitError}
          </div>
        )}

        <button type="submit" disabled={submitting} className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "white" }}>
          {submitting ? "Saving…" : "Continue to Symptoms →"}
        </button>
      </form>

      <p className="text-center text-xs mt-6 leading-relaxed" style={{ color: "#334155" }}>
        AI-HeaRT provides informational guidance only and is not a substitute for professional medical advice.
      </p>
    </div>
  );
}

function Field({ label, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: "#475569" }}>{label}</label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

/* =========================================================================
   SYMPTOM INPUT (autocomplete)
   ========================================================================= */

function SymptomInput({ profile, onAnalyze, onBack, initialSymptoms = [] }) {
  const [selected, setSelected] = useState(initialSymptoms);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const suggestions = query.length >= 1
    ? ALL_SYMPTOMS.filter((s) => !selected.includes(s) &&
        (s.toLowerCase().includes(query.toLowerCase()) || formatSymptom(s).toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  useEffect(() => { setHighlighted(0); }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addSymptom = (s) => {
    if (!selected.includes(s)) setSelected((p) => [...p, s]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeSymptom = (s) => setSelected((p) => p.filter((x) => x !== s));

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && suggestions[highlighted]) { e.preventDefault(); addSymptom(suggestions[highlighted]); }
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Backspace" && !query && selected.length > 0) setSelected((p) => p.slice(0, -1));
  };

  const handleAnalyze = () => {
    const results = analyzeSymptoms(selected);
    onAnalyze(selected, results);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-sm font-medium"
          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
          Step 2 of 3
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: "#f1f5f9" }}>
          What are you experiencing,{" "}
          <span style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {profile.name.split(" ")[0]}
          </span>?
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
          Type a symptom and select from suggestions. Add as many as you're experiencing.
        </p>
      </div>

      <div className="rounded-2xl p-6 mb-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selected.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}>
                {formatSymptom(s)}
                <button onClick={() => removeSymptom(s)} className="hover:opacity-70 transition-opacity ml-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => query.length >= 1 && setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search symptoms — e.g. fatigue, fever, headache…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#e2e8f0" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="hover:opacity-70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {open && suggestions.length > 0 && (
            <div ref={dropRef} className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
              style={{ background: "#0f1e35", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              {suggestions.map((s, i) => (
                <button key={s} onMouseDown={(e) => { e.preventDefault(); addSymptom(s); }} onMouseEnter={() => setHighlighted(i)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors"
                  style={{
                    background: i === highlighted ? "rgba(59,130,246,0.12)" : "transparent",
                    color: i === highlighted ? "#93c5fd" : "#cbd5e1",
                    borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: i === highlighted ? "#60a5fa" : "#334155" }} />
                  {formatSymptom(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold mb-2.5 uppercase tracking-wide" style={{ color: "#334155" }}>Common symptoms</p>
          <div className="flex flex-wrap gap-2">
            {["fatigue", "headache", "nausea", "vomiting", "fever", "cough", "sharp chest pain", "dizziness", "joint pain", "skin rash"].map((s) => {
              const isSelected = selected.includes(s);
              return (
                <button key={s} onClick={() => isSelected ? removeSymptom(s) : addSymptom(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: isSelected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                    color: isSelected ? "#60a5fa" : "#475569",
                    border: isSelected ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                  {isSelected && "✓ "}{formatSymptom(s)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "#475569" }}>
          {selected.length === 0 ? "No symptoms selected" : `${selected.length} symptom${selected.length > 1 ? "s" : ""} selected`}
        </p>
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="text-xs hover:opacity-70 transition-opacity" style={{ color: "#ef4444" }}>
            Clear all
          </button>
        )}
      </div>

      <button onClick={handleAnalyze} disabled={selected.length === 0}
        className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "white" }}>
        {selected.length === 0 ? "Add symptoms to continue" : `Analyze ${selected.length} symptom${selected.length > 1 ? "s" : ""} →`}
      </button>
    </div>
  );
}

/* =========================================================================
   ANALYSIS LOADING
   ========================================================================= */

const ANALYSIS_STEPS = [
  { label: "Parsing symptom profile…", duration: 500 },
  { label: "Cross-referencing 100 disease patterns…", duration: 600 },
  { label: "Running probability engine…", duration: 550 },
  { label: "Applying triage classification…", duration: 500 },
  { label: "Generating recommendations…", duration: 450 },
];

function AnalysisLoading({ symptoms, onDone }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let total = 0;
    const timers = [];
    ANALYSIS_STEPS.forEach((step, i) => {
      timers.push(setTimeout(() => {
        setStepIdx(i);
        setProgress(Math.round(((i + 1) / ANALYSIS_STEPS.length) * 100));
      }, total));
      total += step.duration;
    });
    timers.push(setTimeout(onDone, total + 250));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="relative w-28 h-28 mx-auto mb-10">
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)", animation: "aihrt-ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
        <div className="absolute inset-4 rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)", animation: "aihrt-ping 1.5s cubic-bezier(0,0,0.2,1) infinite 0.3s" }} />
        <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.2))", border: "1px solid rgba(59,130,246,0.3)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#f1f5f9" }}>AI Processing</h2>
      <p className="text-sm mb-8" style={{ color: "#475569" }}>Analyzing {symptoms.length} symptom{symptoms.length !== 1 ? "s" : ""} against our medical database</p>

      <div className="relative h-1.5 rounded-full mb-6 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #06b6d4)" }} />
      </div>

      <div className="space-y-3 text-left mb-8">
        {ANALYSIS_STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-3 transition-opacity" style={{ opacity: i <= stepIdx ? 1 : 0.2 }}>
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{
                background: i < stepIdx ? "rgba(34,197,94,0.2)" : i === stepIdx ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                border: i < stepIdx ? "1px solid rgba(34,197,94,0.4)" : i === stepIdx ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
              }}>
              {i < stepIdx ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              ) : i === stepIdx ? (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#60a5fa", animation: "aihrt-pulse 1s infinite" }} />
              ) : null}
            </div>
            <span className="text-sm" style={{ color: i <= stepIdx ? "#cbd5e1" : "#1e293b" }}>{step.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center">
        {symptoms.slice(0, 8).map((s) => (
          <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(59,130,246,0.08)", color: "#475569", border: "1px solid rgba(59,130,246,0.12)" }}>
            {formatSymptom(s)}
          </span>
        ))}
        {symptoms.length > 8 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "#334155" }}>+{symptoms.length - 8} more</span>
        )}
      </div>

      <style>{`
        @keyframes aihrt-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes aihrt-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

/* =========================================================================
   TRIAGE RESULT + tabs
   ========================================================================= */

const TRIAGE_CONFIG = {
  green: {
    label: "Home Care", sublabel: "Low Risk", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)",
    description: "Your symptoms suggest a low-risk condition manageable at home with proper care.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  yellow: {
    label: "See a Doctor Soon", sublabel: "Moderate Risk", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)",
    description: "Your symptoms warrant non-emergency medical attention. Schedule an appointment soon.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  },
  red: {
    label: "Emergency", sublabel: "High Risk", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)",
    description: "Your symptoms require immediate medical attention. Go to the nearest emergency room now.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  },
};

function TriageResult({ profile, symptoms, results, onReset, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [modalDisease, setModalDisease] = useState(null);
  const triage = determinePrimaryTriage(results);
  const config = TRIAGE_CONFIG[triage];
  const top = results[0];

  if (results.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6 mx-auto transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <p style={{ color: "#64748b" }}>No matching conditions found. Please try adding more symptoms.</p>
        <button onClick={onReset} className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button — returns to symptom selection without losing progress */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-5 transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className="rounded-2xl p-6 mb-5 relative overflow-hidden" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: config.color }} />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${config.border}` }}>
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: config.color }}>{config.sublabel}</span>
              {triage === "red" && <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>URGENT</span>}
            </div>
            <h2 className="text-2xl font-extrabold mb-1" style={{ color: "#f1f5f9" }}>{config.label}</h2>
            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{config.description}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "#0a1628" }}>
        {["overview", "track"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: activeTab === t ? "rgba(59,130,246,0.15)" : "transparent",
              color: activeTab === t ? "#60a5fa" : "#475569",
              border: activeTab === t ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
            }}>
            {t === "track" ? (triage === "green" ? "Home Care Plan" : "Find Care") : "Overview"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          profile={profile}
          symptoms={symptoms}
          results={results}
          triage={triage}
          onViewTrack={() => setActiveTab("track")}
          onReset={onReset}
          onSelectDisease={(result) => setModalDisease(result)}
        />
      )}
      {activeTab === "track" && (
        triage === "green" ? <HomeCareTrack disease={top.disease} profile={profile} /> : <MedicalReferralTrack disease={top.disease} triage={triage} profile={profile} />
      )}

      {modalDisease && (
        <DiseaseDetailModal result={modalDisease} onClose={() => setModalDisease(null)} />
      )}
    </div>
  );
}

function OverviewTab({ profile, symptoms, results, triage, onViewTrack, onReset, onSelectDisease }) {
  const config = TRIAGE_CONFIG[triage];
  return (
    <div className="space-y-4">
      <button
        onClick={() => onSelectDisease(results[0])}
        className="w-full text-left rounded-2xl p-5 transition-all hover:brightness-110"
        style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#334155" }}>Most Likely Condition</p>
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#475569" }}>
            View details
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold" style={{ color: "#f1f5f9" }}>{results[0].disease.name}</h3>
            <p className="text-sm" style={{ color: "#475569" }}>{results[0].disease.department}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold" style={{ color: config.color }}>{formatPercent(results[0].probability)}%</div>
            <div className="text-xs" style={{ color: "#334155" }}>match</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#64748b" }}>{results[0].disease.description}</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#334155" }}>Matched symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {results[0].matchedSymptoms.map((s) => (
              <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
                {formatSymptom(s)}
              </span>
            ))}
          </div>
        </div>
      </button>

      {results.length > 1 && (
        <div className="rounded-2xl p-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#334155" }}>Other Possibilities</p>
          <div className="space-y-3">
            {results.slice(1).map((r) => {
              const tc = TRIAGE_CONFIG[r.disease.triage];
              return (
                <button
                  key={r.disease.name}
                  onClick={() => onSelectDisease(r)}
                  className="w-full flex items-center gap-3 text-left transition-all hover:brightness-110"
                  style={{ cursor: "pointer" }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{r.disease.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{tc.sublabel}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.probability}%`, background: tc.color, opacity: 0.6 }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold w-12 text-right flex-shrink-0" style={{ color: "#475569" }}>{formatPercent(r.probability)}%</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#334155" }}>Patient Profile</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Name", value: profile.name },
            { label: "Age", value: `${profile.age} yrs` },
            { label: "Weight", value: `${profile.weight} kg` },
            { label: "Gender", value: profile.gender },
            { label: "Phone", value: profile.phone },
            { label: "Symptoms", value: `${symptoms.length} reported` },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg min-w-0" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-xs mb-0.5" style={{ color: "#334155" }}>{item.label}</p>
              <p className="text-sm font-semibold truncate" style={{ color: "#e2e8f0" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onViewTrack} className="flex-1 py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}aa)`, color: triage === "yellow" ? "#000" : "white" }}>
          {triage === "green" ? "View Home Care Plan →" : "Find Nearest Hospital →"}
        </button>
        <button onClick={onReset} className="px-5 py-4 rounded-xl font-bold text-sm transition-all hover:opacity-70"
          style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.06)" }}>
          Restart
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   HOME CARE TRACK — sourced entirely from real per-disease data:
   PRECAUTIONS_DB, DIETS_DB, WORKOUTS_DB, MEDICATIONS_DB.
   ========================================================================= */

const TRACKER_ITEMS = [
  { id: "morning", label: "Morning check-in", time: "8:00 AM" },
  { id: "meds", label: "Medication taken", time: "9:00 AM" },
  { id: "hydration", label: "Water intake — 8 glasses", time: "All day" },
  { id: "afternoon", label: "Afternoon check-in", time: "2:00 PM" },
  { id: "exercise", label: "Light activity / walk", time: "5:00 PM" },
  { id: "evening", label: "Evening check-in", time: "8:00 PM" },
  { id: "sleep", label: "Sleep by 10:30 PM", time: "10:30 PM" },
];

function HomeCareTrack({ disease, profile }) {
  const [tab, setTab] = useState("care");
  const [checked, setChecked] = useState({});

  const precautions = getPrecautions(disease.name) || [];
  const diet = getDiet(disease.name) || [];
  const workout = getWorkout(disease.name) || [];
  const medication = getMedications(disease.name) || [];
  const homeTreatment = getHomeTreatment(disease.name);
  const completedCount = Object.values(checked).filter(Boolean).length;

  const TABS = [
    { key: "care", label: "Care Steps" },
    { key: "diet", label: "Diet" },
    { key: "workout", label: "Activity" },
    { key: "medication", label: "Medication" },
    { key: "tracker", label: "Daily Tracker" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 p-4 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "#4ade80" }}>Home Care Plan for {disease.name}</p>
          <p className="text-xs" style={{ color: "#475569" }}>Personalized for {profile.name}, {profile.age} yrs, {profile.weight}kg</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-5 overflow-x-auto" style={{ background: "#0a1628" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap px-2"
            style={{
              background: tab === t.key ? "rgba(34,197,94,0.15)" : "transparent",
              color: tab === t.key ? "#4ade80" : "#475569",
              border: tab === t.key ? "1px solid rgba(34,197,94,0.25)" : "1px solid transparent",
              minWidth: "fit-content",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "care" && (
        <div className="space-y-3">
          {homeTreatment && (
            <div className="p-4 rounded-xl mb-1" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#4ade80" }}>Home Treatment Guide</p>
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{homeTreatment}</p>
            </div>
          )}
          {precautions.length > 0 ? precautions.map((step, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>{i + 1}</div>
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{step}</p>
            </div>
          )) : (
            <p className="text-sm" style={{ color: "#475569" }}>No specific care steps on file for this condition — rest, hydrate, and monitor your symptoms.</p>
          )}
          <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "#fbbf24" }}>
            ⚠️ If symptoms worsen or new severe symptoms appear, seek immediate medical attention.
          </div>
        </div>
      )}

      {tab === "diet" && (
        <div className="space-y-3">
          <p className="text-sm mb-1" style={{ color: "#475569" }}>Dietary guidance to support recovery from {disease.name}.</p>
          {diet.length > 0 ? diet.map((d, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="flex-shrink-0">🍽️</span>
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{d}</p>
            </div>
          )) : (
            <p className="text-sm" style={{ color: "#475569" }}>No specific diet data on file for this condition.</p>
          )}
        </div>
      )}

      {tab === "workout" && (
        <div className="space-y-3">
          <p className="text-sm mb-1" style={{ color: "#475569" }}>Suggested activity levels while recovering from {disease.name}.</p>
          {workout.length > 0 ? workout.map((w, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="flex-shrink-0">🏃</span>
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{w}</p>
            </div>
          )) : (
            <p className="text-sm" style={{ color: "#475569" }}>No specific activity data on file for this condition.</p>
          )}
        </div>
      )}

      {tab === "medication" && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl mb-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
              ⚠️ Informational only — not a prescription. Always consult a doctor or pharmacist before starting any medication.
            </p>
          </div>
          {medication.length > 0 ? medication.map((m, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="flex-shrink-0">💊</span>
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{m}</p>
            </div>
          )) : (
            <p className="text-sm" style={{ color: "#475569" }}>No specific medication data on file for this condition.</p>
          )}
        </div>
      )}

      {tab === "tracker" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>Today's Recovery Checklist</p>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              {completedCount}/{TRACKER_ITEMS.length} done
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completedCount / TRACKER_ITEMS.length) * 100}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
          </div>
          <div className="space-y-2">
            {TRACKER_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                style={{
                  background: checked[item.id] ? "rgba(34,197,94,0.08)" : "#0a1628",
                  border: `1px solid ${checked[item.id] ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}>
                <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-all" style={{
                  background: checked[item.id] ? "#22c55e" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${checked[item.id] ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                }}>
                  {checked[item.id] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="flex-1 text-sm" style={{ color: checked[item.id] ? "#475569" : "#e2e8f0", textDecoration: checked[item.id] ? "line-through" : "none" }}>
                  {item.label}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: "#334155" }}>{item.time}</span>
              </button>
            ))}
          </div>
          {completedCount === TRACKER_ITEMS.length && (
            <div className="mt-4 p-4 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-sm font-bold" style={{ color: "#4ade80" }}>🎉 Great work today, {profile.name.split(" ")[0]}!</p>
              <p className="text-xs mt-1" style={{ color: "#475569" }}>You completed your full recovery checklist.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* =========================================================================
   MEDICAL REFERRAL TRACK
   ========================================================================= */

const MOCK_HOSPITALS = [
  { id: "1", name: "Hospital Kuala Lumpur", type: "Government", distance: 1.2, address: "Jalan Pahang, 50586 Kuala Lumpur", phone: "+603-2615 5555", waitTime: 25, busyness: "Moderate", departments: ["Emergency", "Cardiology", "Neurology", "Hepatology", "Endocrinology", "Pulmonology"], doctorsAvailable: 12, rating: 4.2, operatingHours: "24 hours" },
  { id: "2", name: "Pantai Hospital KL", type: "Private", distance: 2.4, address: "8 Jalan Bukit Pantai, 59100 KL", phone: "+603-2296 0888", waitTime: 10, busyness: "Low", departments: ["Emergency", "Cardiology", "Dermatology", "Gastroenterology", "Orthopedics", "ENT"], doctorsAvailable: 18, rating: 4.7, operatingHours: "24 hours" },
  { id: "3", name: "Klinik Kesihatan Chow Kit", type: "Clinic", distance: 0.7, address: "Jalan Chow Kit, 50350 KL", phone: "+603-2693 1234", waitTime: 40, busyness: "High", departments: ["General Practice", "Internal Medicine"], doctorsAvailable: 4, rating: 3.8, operatingHours: "Mon–Fri 8AM–5PM" },
  { id: "4", name: "Sunway Medical Centre", type: "Private", distance: 8.3, address: "5 Jalan Lagoon Selatan, Subang", phone: "+603-7491 9191", waitTime: 15, busyness: "Low", departments: ["Emergency", "Cardiology", "Neurology", "Oncology", "Orthopedics", "Infectious Disease"], doctorsAvailable: 24, rating: 4.8, operatingHours: "24 hours" },
  { id: "5", name: "Klinik Pakar Pandan Maju", type: "Clinic", distance: 3.1, address: "Jalan Pandan 3/1, 55100 KL", phone: "+603-4291 8888", waitTime: 20, busyness: "Moderate", departments: ["General Practice", "Dermatology", "ENT"], doctorsAvailable: 3, rating: 4.1, operatingHours: "Daily 8AM–10PM" },
];

function MedicalReferralTrack({ disease, triage, profile }) {
  const [filterDept, setFilterDept] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [sortBy, setSortBy] = useState("distance");
  const [selectedHospital, setSelectedHospital] = useState(null);

  const departments = ["All", ...Array.from(new Set(MOCK_HOSPITALS.flatMap((h) => h.departments))).sort()];
  const types = ["All", "Government", "Private", "Clinic"];

  const filtered = MOCK_HOSPITALS
    .filter((h) => filterDept === "All" || h.departments.includes(filterDept))
    .filter((h) => filterType === "All" || h.type === filterType)
    .sort((a, b) => sortBy === "distance" ? a.distance - b.distance : sortBy === "wait" ? a.waitTime - b.waitTime : b.rating - a.rating);

  const urgencyColor = triage === "red" ? "#ef4444" : "#f59e0b";
  const urgencyBg = triage === "red" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)";
  const urgencyBorder = triage === "red" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)";
  const precautions = getPrecautions(disease.name);

  if (selectedHospital) {
    return <HospitalDetail hospital={selectedHospital} disease={disease} profile={profile} onBack={() => setSelectedHospital(null)} triage={triage} />;
  }

  return (
    <div>
      <div className="p-4 rounded-xl mb-5 flex gap-3" style={{ background: urgencyBg, border: `1px solid ${urgencyBorder}` }}>
        {triage === "red" && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
        <div>
          <p className="text-sm font-bold mb-0.5" style={{ color: urgencyColor }}>
            {triage === "red" ? "Seek emergency care immediately" : "Schedule an appointment soon"}
          </p>
          <p className="text-xs" style={{ color: "#64748b" }}>
            Recommended department: <strong style={{ color: "#94a3b8" }}>{disease.department}</strong>
          </p>
        </div>
      </div>

      {precautions && (
        <div className="p-4 rounded-xl mb-5" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#334155" }}>While You Wait</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {precautions.map((p, i) => (
              <div key={i} className="flex gap-2 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="flex-shrink-0" style={{ color: urgencyColor }}>•</span>
                <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden mb-5 relative" style={{ height: 180, background: "#0d1f38" }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(rgba(59,130,246,0.05) 0px, transparent 1px, transparent 39px, rgba(59,130,246,0.05) 40px), repeating-linear-gradient(90deg, rgba(59,130,246,0.05) 0px, transparent 1px, transparent 39px, rgba(59,130,246,0.05) 40px)`,
        }} />
        {MOCK_HOSPITALS.slice(0, 4).map((h, i) => (
          <div key={h.id} className="absolute flex flex-col items-center" style={{ left: `${20 + i * 20}%`, top: `${25 + (i % 2) * 30}%` }}>
            <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: h.busyness === "Low" ? "#22c55e" : h.busyness === "Moderate" ? "#f59e0b" : "#ef4444" }} />
            <div className="px-1.5 py-0.5 rounded text-xs font-semibold mt-1" style={{ background: "rgba(0,0,0,0.7)", color: "#e2e8f0", whiteSpace: "nowrap", fontSize: "9px" }}>
              {h.name.split(" ").slice(0, 2).join(" ")}
            </div>
          </div>
        ))}
        <div className="absolute" style={{ left: "48%", top: "45%" }}>
          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ background: "#3b82f6", borderColor: "white" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
        <div className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8" }}>
          📍 Near {profile.name.split(" ")[0]}'s location
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "#64748b" }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Busy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High</span>
        </div>
      </div>

      <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
        <div>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-medium outline-none" style={{ background: "#0a1628", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
            {departments.slice(0, 12).map((d) => <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5">
          {types.map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: filterType === t ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                color: filterType === t ? "#60a5fa" : "#475569",
                border: filterType === t ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(255,255,255,0.06)",
              }}>
              {t}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs font-medium outline-none ml-auto flex-shrink-0" style={{ background: "#0a1628", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}>
          <option value="distance">Sort: Distance</option>
          <option value="wait">Sort: Wait Time</option>
          <option value="rating">Sort: Rating</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((hospital) => (
          <HospitalCard key={hospital.id} hospital={hospital} disease={disease} onClick={() => setSelectedHospital(hospital)} />
        ))}
        {filtered.length === 0 && <div className="text-center py-10 text-sm" style={{ color: "#334155" }}>No facilities match your filters.</div>}
      </div>
    </div>
  );
}

function HospitalCard({ hospital, disease, onClick }) {
  const busynessColor = hospital.busyness === "Low" ? "#22c55e" : hospital.busyness === "Moderate" ? "#f59e0b" : "#ef4444";
  const hasDept = hospital.departments.some((d) => disease.department.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(disease.department.split("/")[0].toLowerCase().trim()));

  return (
    <button onClick={onClick} className="w-full text-left rounded-xl p-4 transition-all hover:border-opacity-30" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "#f1f5f9" }}>{hospital.name}</span>
            {hasDept && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>Recommended</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#475569" }}>{hospital.type} · {hospital.address}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" className="flex-shrink-0 mt-1"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-2">
        <Stat label="Distance" value={`${hospital.distance} km`} />
        <Stat label="Wait" value={`~${hospital.waitTime} min`} />
        <Stat label="Doctors" value={`${hospital.doctorsAvailable} avail.`} />
        <div className="text-center">
          <p className="text-xs mb-0.5 uppercase tracking-wide" style={{ color: "#334155" }}>Status</p>
          <span className="text-xs font-bold" style={{ color: busynessColor }}>{hospital.busyness}</span>
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xs mb-0.5 uppercase tracking-wide" style={{ color: "#334155" }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{value}</p>
    </div>
  );
}

function HospitalDetail({ hospital, disease, profile, onBack, triage }) {
  const [booked, setBooked] = useState(false);
  const urgencyColor = triage === "red" ? "#ef4444" : "#f59e0b";

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-5 transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back to facilities
      </button>

      <div className="rounded-2xl p-5 mb-4" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold mb-1" style={{ color: "#f1f5f9" }}>{hospital.name}</h3>
            <p className="text-sm" style={{ color: "#475569" }}>{hospital.type} Hospital</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < Math.floor(hospital.rating) ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </div>
            <span className="text-xs" style={{ color: "#475569" }}>{hospital.rating}/5.0</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <InfoItem icon="📍" label="Address" value={hospital.address} />
          <InfoItem icon="📞" label="Phone" value={hospital.phone} />
          <InfoItem icon="🕐" label="Hours" value={hospital.operatingHours} />
          <InfoItem icon="⏱️" label="Est. Wait" value={`~${hospital.waitTime} minutes`} />
        </div>

        <div className="p-3 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#334155" }}>Live Status</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: hospital.busyness === "Low" ? "#22c55e" : hospital.busyness === "Moderate" ? "#f59e0b" : "#ef4444" }} />
              <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{hospital.busyness} traffic</span>
            </div>
            <span className="text-sm" style={{ color: "#475569" }}>·</span>
            <span className="text-sm" style={{ color: "#e2e8f0" }}>{hospital.doctorsAvailable} doctors available</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#334155" }}>Departments</p>
          <div className="flex flex-wrap gap-1.5">
            {hospital.departments.map((dept) => {
              const isMatch = disease.department.toLowerCase().includes(dept.toLowerCase()) || dept.toLowerCase().includes(disease.department.split("/")[0].toLowerCase().trim());
              return (
                <span key={dept} className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: isMatch ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                    color: isMatch ? "#60a5fa" : "#475569",
                    border: isMatch ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                  {dept}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {!booked ? (
        <div className="space-y-3">
          {triage === "red" && (
            <div className="p-4 rounded-xl text-sm font-semibold text-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
              🚨 This is an emergency — go directly to A&E, do not wait for an appointment.
            </div>
          )}
          <button onClick={() => setBooked(true)} className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${urgencyColor}, ${urgencyColor}bb)`, color: triage === "yellow" ? "#000" : "white" }}>
            {triage === "red" ? "🚑 Get Directions to Emergency" : "📅 Book Appointment"}
          </button>
          <button className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-70" style={{ background: "rgba(255,255,255,0.04)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.15)" }}>
            📞 Call {hospital.phone}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: "#4ade80" }}>Appointment Confirmed</h3>
          <p className="text-sm mb-3" style={{ color: "#64748b" }}>
            {profile.name} · {disease.department}<br />{hospital.name}
          </p>
          <div className="px-4 py-2 rounded-xl inline-block text-sm font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#86efac" }}>
            Reference: AH-{Date.now().toString().slice(-6)}
          </div>
          <p className="text-xs mt-4" style={{ color: "#334155" }}>
            A 10% commission will be recorded upon successful treatment as per Ministry of Health partnership guidelines.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div>
      <p className="text-xs mb-0.5 uppercase tracking-wide" style={{ color: "#334155" }}>{label}</p>
      <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>{icon} {value}</p>
    </div>
  );
}

/* =========================================================================
   DISEASE DETAIL MODAL — Overview / Symptoms / Precautions / Diet /
   Workout / Medication, all sourced from the real per-disease datasets.
   ========================================================================= */

const MODAL_TABS = [
  { key: "overview", label: "Overview", icon: "ℹ️" },
  { key: "symptoms", label: "Symptoms", icon: "📈" },
  { key: "precautions", label: "Precautions", icon: "🛡️" },
  { key: "diet", label: "Diet", icon: "🥗" },
  { key: "workout", label: "Workout", icon: "🏃" },
  { key: "medication", label: "Medication", icon: "💊" },
];

function DiseaseDetailModal({ result, onClose }) {
  const [tab, setTab] = useState("overview");
  const { disease, probability, matchedSymptoms } = result;
  const config = TRIAGE_CONFIG[disease.triage];
  const isMinor = disease.triage === "green";

  const precautions = getPrecautions(disease.name) || [];
  const diet = getDiet(disease.name) || [];
  const workout = getWorkout(disease.name) || [];
  const medication = getMedications(disease.name) || [];
  const remainingSymptoms = disease.symptoms.filter((s) => !matchedSymptoms.includes(s));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(2,6,15,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
                {config.sublabel}
              </span>
              <span className="text-xs" style={{ color: "#475569" }}>{formatPercent(probability)}% match</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: "#f1f5f9" }}>{disease.name}</h2>
          <p className="text-sm" style={{ color: "#475569" }}>{disease.department}</p>
        </div>

        <div className="p-5 pb-0 flex-shrink-0">
          {/* Dynamic warning banner */}
          {isMinor ? (
            <div className="p-3.5 rounded-xl mb-4 flex gap-2.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span className="text-lg flex-shrink-0">🏠</span>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: "#4ade80" }}>Home Care Guidelines</p>
                <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                  This is typically a minor, manageable condition. Rest, hydration, and the steps below are usually enough — but seek care if symptoms worsen or persist.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl mb-4 flex gap-2.5" style={{ background: disease.triage === "red" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${disease.triage === "red" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}` }}>
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-bold mb-0.5" style={{ color: disease.triage === "red" ? "#ef4444" : "#f59e0b" }}>
                    {disease.triage === "red" ? "Emergency Action Advised" : "Prompt Medical Attention Advised"}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                    {disease.triage === "red"
                      ? "This condition can be serious. Please seek immediate professional medical attention at a clinic or hospital rather than relying on home care alone."
                      : "This condition can be serious. Please contact a clinic or hospital and seek professional medical attention soon rather than relying on home care alone."}
                  </p>
                </div>
              </div>
          )}
        </div>

        {/* Tab grid — 2 rows x 3 cols */}
        <div className="px-5 pb-4 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {MODAL_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                style={{
                  background: tab === t.key ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                  border: tab === t.key ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span className="text-xs font-semibold" style={{ color: tab === t.key ? "#60a5fa" : "#475569" }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 overflow-y-auto" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          {tab === "overview" && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{disease.overview || disease.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "#334155" }}>Department</p>
                  <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{disease.department}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "#334155" }}>Risk Level</p>
                  <p className="text-sm font-semibold" style={{ color: config.color }}>{config.sublabel}</p>
                </div>
              </div>
            </div>
          )}

          {tab === "symptoms" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "#334155" }}>
                  📈 Symptoms You Reported That Match
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedSymptoms.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
                      {formatSymptom(s)}
                    </span>
                  ))}
                </div>
              </div>
              {remainingSymptoms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "#334155" }}>
                    📈 Remaining Symptoms of This Disease
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {remainingSymptoms.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {formatSymptom(s)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "precautions" && (
            <div className="space-y-3">
              {precautions.length > 0 ? precautions.map((p, i) => (
                <div key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: config.bg, color: config.color }}>{i + 1}</div>
                  <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{p}</p>
                </div>
              )) : <p className="text-sm" style={{ color: "#475569" }}>No precaution data on file for this condition.</p>}
            </div>
          )}

          {tab === "diet" && (
            <div className="space-y-3">
              {diet.length > 0 ? diet.map((d, i) => (
                <div key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="flex-shrink-0">🍽️</span>
                  <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{d}</p>
                </div>
              )) : <p className="text-sm" style={{ color: "#475569" }}>No diet data on file for this condition.</p>}
            </div>
          )}

          {tab === "workout" && (
            <div className="space-y-3">
              {workout.length > 0 ? workout.map((w, i) => (
                <div key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="flex-shrink-0">🏃</span>
                  <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{w}</p>
                </div>
              )) : <p className="text-sm" style={{ color: "#475569" }}>No activity data on file for this condition.</p>}
            </div>
          )}

          {tab === "medication" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
                  ⚠️ Informational only — not a prescription. Always consult a doctor or pharmacist before starting any medication.
                </p>
              </div>
              {medication.length > 0 ? medication.map((m, i) => (
                <div key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="flex-shrink-0">💊</span>
                  <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{m}</p>
                </div>
              )) : <p className="text-sm" style={{ color: "#475569" }}>No medication data on file for this condition.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* =========================================================================
   APP SHELL
   ========================================================================= */

function StepIndicator({ current }) {
  const steps = [
    { key: "profile", label: "Profile" },
    { key: "symptoms", label: "Symptoms" },
    { key: "analyzing", label: "Analysis" },
    { key: "result", label: "Results" },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  if (idx === -1) return null; // e.g. "history" — no step indicator for that view

  return (
    <div className="hidden sm:flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: i === idx ? "rgba(59,130,246,0.2)" : i < idx ? "rgba(34,197,94,0.1)" : "transparent",
              color: i === idx ? "#60a5fa" : i < idx ? "#4ade80" : "#475569",
              border: i === idx ? "1px solid rgba(59,130,246,0.35)" : i < idx ? "1px solid rgba(34,197,94,0.2)" : "1px solid transparent",
            }}>
            {i < idx ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: i === idx ? "#60a5fa" : "#334155", display: "inline-block", flexShrink: 0 }} />
            )}
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="w-4 h-px" style={{ background: "#1e293b" }} />}
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   HISTORY — GET /api/patient/symptom-checks
   ========================================================================= */

function HistoryView({ token, onBack }) {
  const [checks, setChecks] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/patient/symptom-checks?limit=50", { token })
      .then((result) => { if (!cancelled) setChecks(result.symptomChecks); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load history."); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: "#475569" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#f1f5f9" }}>Your Check History</h1>
      <p className="text-sm mb-6" style={{ color: "#64748b" }}>Every symptom check you've completed, saved to your account.</p>

      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {!error && checks === null && (
        <p className="text-sm" style={{ color: "#475569" }}>Loading…</p>
      )}

      {checks && checks.length === 0 && (
        <p className="text-sm" style={{ color: "#475569" }}>No checks yet — run your first symptom check and it'll show up here.</p>
      )}

      {checks && checks.length > 0 && (
        <div className="space-y-3">
          {checks.map((c) => {
            const tc = TRIAGE_CONFIG[c.triage] || TRIAGE_CONFIG.yellow;
            const top = c.results && c.results[0];
            return (
              <div key={c.id} className="rounded-xl p-4" style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                    {tc.sublabel}
                  </span>
                  <span className="text-xs" style={{ color: "#334155" }}>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                {top && (
                  <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>
                    {top.disease} <span style={{ color: "#475569", fontWeight: 500 }}>· {formatPercent(top.probability)}% match</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(c.symptoms || []).map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
                      {formatSymptom(s)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GENDER_TO_BACKEND = { Male: "male", Female: "female", Other: "other" };
const GENDER_FROM_BACKEND = { male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Other" };

export default function App() {
  // ---- Auth state ----
  const [authStep, setAuthStep] = useState("phone"); // "phone" | "otp" | "app"
  const [pendingAuth, setPendingAuth] = useState(null); // { phoneNumber, purpose, devCode, expiresInSeconds }
  const [patient, setPatient] = useState(null); // sanitized patient record from backend
  const [token, setToken] = useState(null);

  // ---- In-app flow state (once authenticated) ----
  const [step, setStep] = useState("profile"); // "profile" | "symptoms" | "analyzing" | "result" | "history"
  const [symptoms, setSymptoms] = useState([]);
  const [results, setResults] = useState([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const profile = patient
    ? {
        name: patient.name || "",
        age: patient.age || "",
        gender: patient.gender ? GENDER_FROM_BACKEND[patient.gender] || "Other" : "",
        weight: patient.weightKg || "",
        phone: patient.phoneNumber || "",
      }
    : { name: "", age: "", gender: "", weight: "", phone: "" };

  const handleOtpRequested = (pending) => {
    setPendingAuth(pending);
    setAuthStep("otp");
  };

  const handleVerified = (patientRecord, sessionToken) => {
    setPatient(patientRecord);
    setToken(sessionToken);
    setAuthStep("app");
    setStep(patientRecord.name ? "symptoms" : "profile");
  };

  const handleBackToPhone = () => {
    setAuthStep("phone");
    setPendingAuth(null);
  };

  const handleProfileNext = async (form) => {
    setProfileError("");
    setProfileSaving(true);
    try {
      const body = {
        name: form.name,
        age: Number(form.age),
        gender: GENDER_TO_BACKEND[form.gender] || "prefer_not_to_say",
        weightKg: Number(form.weight),
      };
      const result = await apiFetch("/api/patient/me", { method: "PUT", token, body });
      setPatient(result.patient);
      setStep("symptoms");
    } catch (err) {
      setProfileError(err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAnalyze = (s, res) => { setSymptoms(s); setResults(res); setStep("analyzing"); };

  const handleAnalysisDone = async () => {
    setStep("result");
    // Save this check to the account's history. Fire-and-forget: a failed
    // save shouldn't block the user from seeing their results.
    try {
      await apiFetch("/api/patient/symptom-checks", {
        method: "POST",
        token,
        body: {
          symptoms,
          results: results.map((r) => ({ disease: r.disease.name, probability: r.probability })),
          triage: determinePrimaryTriage(results),
        },
      });
    } catch (err) {
      console.error("Failed to save symptom check:", err);
    }
  };

  // "New check" — keeps the account/profile, just clears the current symptoms/results.
  const handleReset = () => {
    setStep("symptoms");
    setSymptoms([]);
    setResults([]);
  };

  const handleLogout = async () => {
    try {
      if (token) await apiFetch("/api/auth/logout", { method: "POST", token });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    setPatient(null);
    setToken(null);
    setPendingAuth(null);
    setAuthStep("phone");
    setStep("profile");
    setSymptoms([]);
    setResults([]);
  };

  // ---- Unauthenticated views ----
  if (authStep === "phone") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 overflow-x-hidden"
        style={{ background: "#060d1b", fontFamily: "system-ui, -apple-system, sans-serif", paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        <PhoneAuthStep onOtpRequested={handleOtpRequested} />
      </div>
    );
  }
  if (authStep === "otp") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 overflow-x-hidden"
        style={{ background: "#060d1b", fontFamily: "system-ui, -apple-system, sans-serif", paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        <OtpStep pending={pendingAuth} onVerified={handleVerified} onBack={handleBackToPhone} />
      </div>
    );
  }

  // ---- Authenticated app ----
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#060d1b", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header className="border-b sticky top-0 z-40" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(6,13,27,0.95)", backdropFilter: "blur(12px)", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight truncate" style={{ color: "#e2e8f0" }}>AI-HeaRT</span>
            <span className="hidden min-[420px]:inline-block text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>Beta</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            <StepIndicator current={step} />
            <button onClick={() => setStep("history")} className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all hover:opacity-80 whitespace-nowrap"
              style={{ background: step === "history" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)", color: step === "history" ? "#60a5fa" : "#475569" }}>
              History
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "#334155" }}>
              {patient?.phoneNumber}
            </div>
            <button onClick={handleLogout} aria-label="Log out" className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all hover:opacity-80 whitespace-nowrap" style={{ background: "rgba(255,255,255,0.04)", color: "#475569" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
        {step === "profile" && (
          <ProfileSetup onNext={handleProfileNext} initialValues={profile} submitting={profileSaving} submitError={profileError} />
        )}
        {step === "symptoms" && (
          <SymptomInput profile={profile} onAnalyze={handleAnalyze} onBack={() => setStep("profile")} initialSymptoms={symptoms} />
        )}
        {step === "analyzing" && <AnalysisLoading symptoms={symptoms} onDone={handleAnalysisDone} />}
        {step === "result" && (
          <TriageResult profile={profile} symptoms={symptoms} results={results} onReset={handleReset} onBack={() => setStep("symptoms")} />
        )}
        {step === "history" && <HistoryView token={token} onBack={() => setStep(results.length ? "result" : "symptoms")} />}
      </main>
    </div>
  );
}
