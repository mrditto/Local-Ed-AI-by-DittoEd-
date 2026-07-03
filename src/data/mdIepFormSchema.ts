export type DeterministicInputType = "text" | "date" | "select" | "checkbox";

export interface MdIepDeterministicField {
  id: string;
  label: string;
  kind: "deterministic";
  inputType: DeterministicInputType;
  required?: boolean;
  options?: readonly string[];
  helpText?: string;
  placeholder?: string;
}

export interface MdIepNarrativeField {
  id: string;
  label: string;
  kind: "narrative";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  aiPromptContext: string;
}

export type MdIepField = MdIepDeterministicField | MdIepNarrativeField;

export interface MdIepSectionSchema {
  id: string;
  title: string;
  description: string;
  skippable: boolean;
  teamDetermination: boolean;
  transitionAgeGate?: 14;
  repeatable?: {
    addLabel: string;
    itemLabel: string;
    minItems: number;
  };
  fields: readonly MdIepField[];
}

export const IEP_TEAM_DETERMINATIONS_LABEL =
  "IEP Team determinations - record what the team decided, the app will not draft these";

export const SPED_HIDDEN_PREFIX_GUARDRAIL =
  "Never use a real student's name — write [Student] instead. This is a draft that requires review and approval by the full IEP team; do not make eligibility, placement, or disciplinary determinations.";

const YES_NO = ["Yes", "No"] as const;

const DISABILITY_OPTIONS = [
  "Autism",
  "Developmental Delay",
  "Intellectual Disability",
  "Deaf",
  "Emotional Disability",
  "Orthopedic Impairment",
  "Specific Learning Disability",
  "Speech or Language Impairment",
  "Visual Impairment",
  "Traumatic Brain Injury",
  "Other Health Impairment",
  "Deaf-Blindness",
  "Hearing Impairment",
  "Multiple Disabilities",
] as const;

const PROGRESS_METHOD_OPTIONS = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Interim",
  "Quarterly",
  "End of marking period",
  "Other",
] as const;

const SERVICE_CATEGORY_OPTIONS = [
  "Special Education",
  "Related Services",
  "Career and Technology Education Services",
] as const;

const SERVICE_FREQUENCY_OPTIONS = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Semi-annually",
  "Yearly",
  "Only once",
  "Other",
] as const;

const LRE_OPTIONS = [
  "Inside General Education (80% or more)",
  "Inside General Education (40-79%)",
  "Inside General Education (less than 40%)",
  "Public Separate Day School",
  "Private Separate Day School",
  "Public Residential Facility",
  "Private Residential Facility",
  "Homebound/Hospital",
  "Correctional Facilities",
  "Parentally placed in private school",
] as const;

export const mdIepFormSections: readonly MdIepSectionSchema[] = [
  {
    id: "student-school-information",
    title: "Student & School Information",
    description:
      "Student demographics, parent contacts, language/interpreter details, school/service information, disability and key dates.",
    skippable: true,
    teamDetermination: false,
    fields: [
      { id: "studentFirstName", label: "Student first name", kind: "deterministic", inputType: "text", required: true },
      { id: "studentMiddleName", label: "Student middle name", kind: "deterministic", inputType: "text" },
      { id: "studentLastName", label: "Student last name", kind: "deterministic", inputType: "text", required: true },
      { id: "iepMeetingDate", label: "IEP team meeting date", kind: "deterministic", inputType: "date", required: true },
      { id: "dateOfBirth", label: "Date of birth", kind: "deterministic", inputType: "date", required: true },
      { id: "studentAge", label: "Age", kind: "deterministic", inputType: "text", placeholder: "Optional override if DOB is unavailable" },
      { id: "grade", label: "Grade", kind: "deterministic", inputType: "text" },
      { id: "stateStudentId", label: "Unique student identification number (State)", kind: "deterministic", inputType: "text" },
      { id: "localStudentId", label: "Student identification number (Local)", kind: "deterministic", inputType: "text" },
      { id: "ethnicityHispanicLatino", label: "Ethnicity: Hispanic or Latino", kind: "deterministic", inputType: "checkbox" },
      { id: "raceCodes", label: "Race code(s)", kind: "deterministic", inputType: "text", placeholder: "Example: White; Black or African American" },
      { id: "englishLearner", label: "Student identified as an English Learner", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "studentNativeLanguage", label: "Student native language", kind: "deterministic", inputType: "text" },
      { id: "parent1Contact", label: "Parent/Guardian 1 contact details", kind: "deterministic", inputType: "text", placeholder: "Name, address, phones, email, native language, interpreter need" },
      { id: "parent2Contact", label: "Parent/Guardian 2 contact details", kind: "deterministic", inputType: "text", placeholder: "Name, address, phones, email, native language, interpreter need" },
      { id: "caseManager", label: "Case manager", kind: "deterministic", inputType: "text" },
      { id: "residenceCounty", label: "Residence county", kind: "deterministic", inputType: "text" },
      { id: "residenceSchool", label: "Residence school", kind: "deterministic", inputType: "text" },
      { id: "serviceCounty", label: "Service county", kind: "deterministic", inputType: "text" },
      { id: "serviceSchool", label: "Service school", kind: "deterministic", inputType: "text" },
      { id: "mostRecentEvaluationDate", label: "Most recent evaluation date", kind: "deterministic", inputType: "date" },
      { id: "projectedEvaluationDate", label: "Projected evaluation date", kind: "deterministic", inputType: "date" },
      { id: "iepAnnualReviewDate", label: "IEP annual review date", kind: "deterministic", inputType: "date" },
      { id: "projectedAnnualReviewDate", label: "Projected annual review date", kind: "deterministic", inputType: "date" },
      { id: "primaryDisability", label: "Primary disability", kind: "deterministic", inputType: "select", options: DISABILITY_OPTIONS },
      { id: "areasAffectedByDisability", label: "Areas affected by disability", kind: "deterministic", inputType: "text" },
      { id: "emergencyEvacuationNeeded", label: "Requires specific accommodation for emergency evacuation", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "emergencyEvacuationDetails", label: "Emergency evacuation accommodation details", kind: "deterministic", inputType: "text" },
    ],
  },
  {
    id: "iep-team-participants",
    title: "IEP Team Participants",
    description: "Record all required and additional participants who attended the meeting.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "iepCaseManagerParticipant", label: "IEP case manager", kind: "deterministic", inputType: "text" },
      { id: "principalDesignee", label: "Principal/Designee", kind: "deterministic", inputType: "text" },
      { id: "iepChair", label: "IEP chair", kind: "deterministic", inputType: "text" },
      { id: "parentGuardianParticipants", label: "Parent/Guardian participant(s)", kind: "deterministic", inputType: "text", required: true },
      { id: "generalEducator", label: "General educator", kind: "deterministic", inputType: "text" },
      { id: "specialEducator", label: "Special educator", kind: "deterministic", inputType: "text" },
      { id: "studentParticipant", label: "Student", kind: "deterministic", inputType: "text" },
      { id: "schoolPsychologist", label: "School psychologist", kind: "deterministic", inputType: "text" },
      { id: "speechLanguagePathologist", label: "Speech/Language pathologist", kind: "deterministic", inputType: "text" },
      { id: "agencyRepresentative", label: "Agency representative", kind: "deterministic", inputType: "text" },
      { id: "guidanceCounselor", label: "Guidance counselor", kind: "deterministic", inputType: "text" },
      { id: "socialWorker", label: "Social worker", kind: "deterministic", inputType: "text" },
      { id: "otherAttendees", label: "Other attendees", kind: "deterministic", inputType: "text", placeholder: "List names and roles" },
    ],
  },
  {
    id: "meeting-eligibility",
    title: "I. Meeting / Identifying & Eligibility Information",
    description:
      "Initial evaluation eligibility data, initial eligibility outcomes (prior to age 3 and ages 3-21), continued eligibility, and basis/discussion fields.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "suspectedDisabilityAreas", label: "Area(s) impacted by suspected disability", kind: "deterministic", inputType: "text" },
      { id: "determinantReadingInstruction", label: "Determinant factor: lack of appropriate reading instruction", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "determinantMathInstruction", label: "Determinant factor: lack of instruction in math", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "determinantEnglishProficiency", label: "Determinant factor: lack of English proficiency", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "requiresSdi", label: "Requires specially designed instruction", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "initialEvalConsentDate", label: "Date of parent consent for initial evaluation", kind: "deterministic", inputType: "date" },
      { id: "initialEvaluationDate", label: "Date of initial evaluation", kind: "deterministic", inputType: "date" },
      { id: "initialEligibilityPriorTo3", label: "Initial eligibility (prior to age 3)", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "initialEligibilityAges3to21", label: "Initial eligibility (ages 3-21)", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "documentBasisEligibility", label: "Document basis for eligibility decision(s)", kind: "deterministic", inputType: "text" },
      { id: "reevaluationAreas", label: "Continued eligibility: area(s) identified for reevaluation", kind: "deterministic", inputType: "text" },
      { id: "reevaluationDate", label: "Reevaluation date", kind: "deterministic", inputType: "date" },
      { id: "continuesToHaveDisability", label: "Continues to have a disability requiring services", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "modificationsNeededForGoals", label: "Additions/modifications needed to meet annual goals", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "eligibleStudentWithDisability", label: "Eligible as a student with a disability", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "ifspTransitionFromPartC", label: "Transitioning from Part C to Part B and receiving IEP services", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "delayReasons", label: "Reason(s) for delay (evaluation/IEP in effect)", kind: "deterministic", inputType: "text" },
    ],
  },
  {
    id: "assessment-participation",
    title: "Assessment Participation",
    description:
      "District/statewide participation, MCAP and high school assessments, alternate assessments/standards, graduation pathway, and English language proficiency summary.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "graduationRequirementsExplained", label: "Graduation requirements explained to parents", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "localGraduationRequirements", label: "Additional local graduation requirements", kind: "deterministic", inputType: "text" },
      { id: "mcapGrade3to8Participation", label: "MCAP grades 3-8 participation summary", kind: "deterministic", inputType: "text", placeholder: "ELA, Math, Social Studies, Science participation decisions" },
      { id: "mcapHighSchoolParticipation", label: "MCAP/high school participation summary", kind: "deterministic", inputType: "text", placeholder: "ELA, Algebra I/II, Geometry, MISA, Government" },
      { id: "alternateAssessmentDetermined", label: "IEP team determined alternate assessment based on alternate standards", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "alternateAssessmentParentConsent", label: "Parent consent for alternate assessment", kind: "deterministic", inputType: "select", options: ["Yes (with written consent date)", "No (with written refusal date)", "No response within 15 business days"] },
      { id: "alternateStandardsInstructionDetermined", label: "IEP team determined instruction using alternate standards", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "alternateStandardsParentConsent", label: "Parent consent for instruction using alternate standards", kind: "deterministic", inputType: "select", options: ["Yes (with written consent date)", "No (with written refusal date)", "No response within 15 business days"] },
      { id: "assessmentDecisionBasis", label: "Document basis for assessment decision(s)", kind: "deterministic", inputType: "text" },
      { id: "diplomaPath", label: "Student is pursuing", kind: "deterministic", inputType: "select", options: ["Maryland High School Diploma", "Maryland High School Certificate of Program Completion"] },
      { id: "hsaWaiverDiscussion", label: "HSA waiver recommendation discussed/supported", kind: "deterministic", inputType: "text" },
      { id: "englishLearnerAssessmentSummary", label: "English language proficiency summary", kind: "deterministic", inputType: "text", placeholder: "Assessment date(s), composite level(s), and MCAP performance summaries" },
    ],
  },
  {
    id: "present-levels",
    title: "II. Present Level of Academic Achievement and Functional Performance",
    description:
      "Complete school-aged and/or preschool present levels, including parent input, strengths/needs, assessment summaries, and disability impact.",
    skippable: true,
    teamDetermination: false,
    fields: [
      { id: "isPreschoolFormUsed", label: "Preschool-aged present levels section used", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "isSchoolAgedFormUsed", label: "School-aged present levels section used", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "preschoolSettings", label: "Where the child spends time", kind: "deterministic", inputType: "text" },
      { id: "preschoolParentConcerns", label: "Preschool parent concerns and priorities (draft with AI)", kind: "narrative", aiPromptContext: "Parent concerns and priorities regarding preschool educational and functional performance.", placeholder: "Seed notes for parent concerns/priorities" },
      { id: "preschoolDisabilityImpact", label: "How disability affects access/participation in age-appropriate activities (draft with AI)", kind: "narrative", aiPromptContext: "How the disability affects access to and participation in age-appropriate activities.", placeholder: "Seed notes on disability impact in preschool settings" },
      { id: "preschoolStrengthsNeedsSummary", label: "Strengths and needs summary across functional areas (draft with AI)", kind: "narrative", aiPromptContext: "Strengths and needs summary for social-emotional, knowledge/skills, and behaviors to meet needs.", placeholder: "Seed notes for COS and strengths/needs ratings" },
      { id: "schoolParentInput", label: "Parental input regarding educational program (draft with AI)", kind: "narrative", aiPromptContext: "Parental input regarding school-aged educational program.", placeholder: "Seed notes from parent input" },
      { id: "schoolStrengthsInterests", label: "Student strengths, interests, attributes, accomplishments (draft with AI)", kind: "narrative", aiPromptContext: "Student strengths, interests, personal attributes, accomplishments, and post-school preferences.", placeholder: "Seed notes for strengths/interests" },
      { id: "schoolDisabilityImpact", label: "How disability affects involvement in general education curriculum (draft with AI)", kind: "narrative", aiPromptContext: "How the disability affects involvement and progress in the general education curriculum.", placeholder: "Seed notes for disability impact" },
      { id: "academicPerformanceSummary", label: "Academic/health/physical/behavioral performance summary", kind: "deterministic", inputType: "text", placeholder: "Sources, findings, levels, and impact determinations" },
      { id: "earlyLearningSkillsSummary", label: "Early learning skills summary (if applicable)", kind: "deterministic", inputType: "text" },
    ],
  },
  {
    id: "special-considerations-accommodations",
    title: "III. Special Considerations and Accommodations",
    description:
      "Communication, AT, vision/hearing, behavior, EL, instructional/testing accommodations, and supplementary aids/services/program modifications/supports.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "specialCommunicationNeeds", label: "Special communication needs", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "specialCommunicationDetails", label: "Specific communication needs details", kind: "deterministic", inputType: "text" },
      { id: "assistiveTechnologyDecision", label: "Assistive technology decision", kind: "deterministic", inputType: "text", placeholder: "Device/services required and trial notes" },
      { id: "visionServiceSummary", label: "Blind/visually impaired service decision summary", kind: "deterministic", inputType: "text", placeholder: "Braille, O&M, parent information decisions" },
      { id: "hearingServiceSummary", label: "Deaf/hearing impaired service decision summary", kind: "deterministic", inputType: "text" },
      { id: "behaviorInterventionSummary", label: "Behavioral intervention/FBA/BIP and parent consent summary", kind: "deterministic", inputType: "text" },
      { id: "englishLearnerServiceSummary", label: "Service for students who are English learners", kind: "deterministic", inputType: "text" },
      { id: "instructionalTestingAccommodations", label: "Instructional/testing accommodations selected", kind: "deterministic", inputType: "text", placeholder: "Presentation, response, timing/scheduling, accessibility features, and unique accommodations" },
      { id: "accommodationsRationale", label: "Accommodation rationale (draft with AI)", kind: "narrative", aiPromptContext: "Rationale supporting selected accommodations and accessibility features for instruction and assessments.", placeholder: "Seed notes on why selected accommodations are needed" },
      { id: "supplementaryAidsInstructionalSupports", label: "Supplementary aids/services/program modifications/supports selected", kind: "deterministic", inputType: "text", placeholder: "Instructional supports, program modifications, social/behavior, physical/environmental, school personnel/parent supports, location/manner" },
      { id: "supplementaryAidsRationale", label: "Supplementary aids/services rationale (draft with AI)", kind: "narrative", aiPromptContext: "Rationale for supplementary aids, services, program modifications, and supports decisions.", placeholder: "Seed notes on rationale and supporting discussion" },
      { id: "noAccommodationsOrSupports", label: "No accommodations/supports required at this time", kind: "deterministic", inputType: "select", options: YES_NO },
    ],
  },
  {
    id: "esy",
    title: "ESY",
    description:
      "Extended School Year decision factors, discussion for each factor, and final eligibility determination.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "esyDecisionDeferred", label: "ESY decision deferred", kind: "deterministic", inputType: "checkbox" },
      { id: "esyCriticalLifeSkillsGoals", label: "IEP includes annual goals related to critical life skills", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyRegressionRisk", label: "Likely substantial regression with failure to recover in reasonable time", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyProgressTowardMastery", label: "Degree of progress toward mastery of critical life skills goals", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyEmergingSkills", label: "Presence of emerging skills or breakthrough opportunities", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyInterferingBehaviors", label: "Significant interfering behaviors", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyNatureSeverity", label: "Nature/severity of disability warrants ESY", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyOtherCircumstances", label: "Other special circumstances require ESY", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "esyDecision", label: "Final ESY eligibility decision", kind: "deterministic", inputType: "select", options: ["Yes, student is eligible for ESY service", "No, student is not eligible for ESY service"] },
      { id: "esyDecisionBasis", label: "Document basis/discussion for ESY decision", kind: "deterministic", inputType: "text" },
    ],
  },
  {
    id: "transition",
    title: "Transition (Age 14+)",
    description:
      "Student interests/preferences, postsecondary goals, course of study, transition activities, agency linkage, and transition discussion.",
    skippable: true,
    teamDetermination: false,
    transitionAgeGate: 14,
    fields: [
      { id: "annualStudentInterviewDate", label: "Date of annual student interview", kind: "deterministic", inputType: "date" },
      { id: "transitionAssessmentsSummary", label: "Student preferences/interests and age-appropriate transition assessments (draft with AI)", kind: "narrative", aiPromptContext: "Discussion of student interests, preferences, and transition assessment results.", placeholder: "Seed notes from student interview and assessment results" },
      { id: "postsecondaryEmploymentGoal", label: "Postsecondary employment goal", kind: "deterministic", inputType: "text", required: true },
      { id: "postsecondaryTrainingGoal", label: "Postsecondary training goal", kind: "deterministic", inputType: "text" },
      { id: "postsecondaryEducationGoal", label: "Postsecondary education goal", kind: "deterministic", inputType: "text" },
      { id: "postsecondaryIndependentLivingGoal", label: "Postsecondary independent living goal (if appropriate)", kind: "deterministic", inputType: "text" },
      { id: "courseOfStudyCareerCluster", label: "Career cluster/course of study", kind: "deterministic", inputType: "text" },
      { id: "projectedExitCategory", label: "Projected category of exit", kind: "deterministic", inputType: "text" },
      { id: "projectedExitDate", label: "Projected date of exit", kind: "deterministic", inputType: "date" },
      { id: "ageOfMajorityRightsInformed", label: "Student/parents informed about age of majority rights", kind: "deterministic", inputType: "select", options: ["Yes", "N/A"] },
      { id: "transitionActivitiesSummary", label: "Transition activities/services summary (draft with AI)", kind: "narrative", aiPromptContext: "Transition services/activities across academic, employment training, daily living, independent living, transportation, responsible parties, and progress status.", placeholder: "Seed notes for activities, parties, and progress reports" },
      { id: "transitionAgencyLinkageSummary", label: "Transition agency linkage and consent/referral summary", kind: "deterministic", inputType: "text", placeholder: "DORS, DDA, BHA, MDL and linkage decisions" },
      { id: "transitionAdditionalDiscussion", label: "Additional transition discussion (draft with AI)", kind: "narrative", aiPromptContext: "Additional transition agency linkage and decision discussion.", placeholder: "Seed notes for additional transition discussion" },
    ],
  },
  {
    id: "goals",
    title: "IV. Goals",
    description:
      "Add one or more annual goal blocks with condition/behavior/criterion, ESY goal indicator, progress code tracking, and progress reporting method.",
    skippable: true,
    teamDetermination: false,
    repeatable: {
      addLabel: "Add goal",
      itemLabel: "Goal",
      minItems: 1,
    },
    fields: [
      { id: "goalArea", label: "Goal area/title", kind: "deterministic", inputType: "text", required: true },
      { id: "goalDraft", label: "Goal statement draft (draft with AI)", kind: "narrative", aiPromptContext: "Annual IEP goal statement aligned to condition, behavior, and criterion.", placeholder: "Seed notes and baseline data for drafting goal language" },
      { id: "goalCondition", label: "Condition", kind: "deterministic", inputType: "text", required: true },
      { id: "goalBehavior", label: "Behavior", kind: "deterministic", inputType: "text", required: true },
      { id: "goalCriterion", label: "Criterion", kind: "deterministic", inputType: "text", required: true },
      { id: "goalTargetDate", label: "Target date (By)", kind: "deterministic", inputType: "date" },
      { id: "goalEvaluationMethod", label: "Evaluation method", kind: "deterministic", inputType: "text", placeholder: "Informal procedures, classroom-based, observation, portfolio, standardized, other" },
      { id: "goalEsyFlag", label: "ESY goal", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "goalProgressCodeSummary", label: "Progress codes and progress report notes", kind: "deterministic", inputType: "text" },
      { id: "parentNotificationMethod", label: "How parent will be notified of progress", kind: "deterministic", inputType: "text" },
      { id: "parentNotificationFrequency", label: "Parent progress reporting frequency", kind: "deterministic", inputType: "select", options: PROGRESS_METHOD_OPTIONS },
    ],
  },
  {
    id: "services",
    title: "V. Services",
    description:
      "Add service entries for special education, related services, and career/technology services, including ESY variants, location, frequency, provider(s), and delivery discussion.",
    skippable: true,
    teamDetermination: true,
    repeatable: {
      addLabel: "Add service",
      itemLabel: "Service",
      minItems: 1,
    },
    fields: [
      { id: "serviceCategory", label: "Service category", kind: "deterministic", inputType: "select", options: SERVICE_CATEGORY_OPTIONS, required: true },
      { id: "serviceNature", label: "Service nature", kind: "deterministic", inputType: "text", required: true },
      { id: "serviceDescription", label: "Service description", kind: "deterministic", inputType: "text" },
      { id: "serviceLocation", label: "Location", kind: "deterministic", inputType: "select", options: ["In General Education", "Outside General Education", "Other"] },
      { id: "serviceFrequency", label: "Frequency", kind: "deterministic", inputType: "select", options: SERVICE_FREQUENCY_OPTIONS },
      { id: "serviceSessions", label: "Number of sessions", kind: "deterministic", inputType: "text" },
      { id: "serviceLength", label: "Length of time", kind: "deterministic", inputType: "text", placeholder: "Hours/minutes" },
      { id: "serviceBeginDate", label: "Begin date", kind: "deterministic", inputType: "date" },
      { id: "serviceEndDate", label: "End date", kind: "deterministic", inputType: "date" },
      { id: "serviceDurationWeeks", label: "Duration (weeks)", kind: "deterministic", inputType: "text" },
      { id: "serviceProviders", label: "Provider(s)", kind: "deterministic", inputType: "text" },
      { id: "serviceSummary", label: "Summary of service / total service time", kind: "deterministic", inputType: "text" },
      { id: "serviceTransportation", label: "Transportation included", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "isEsyService", label: "ESY service entry", kind: "deterministic", inputType: "checkbox" },
      { id: "serviceDeliveryDiscussion", label: "Discussion of service delivery", kind: "deterministic", inputType: "text" },
    ],
  },
  {
    id: "lre-placement",
    title: "LRE / Placement",
    description:
      "Least Restrictive Environment decisions, placement option considered/selected, harmful effects, home-school proximity, transportation needs, and participation with nondisabled peers.",
    skippable: true,
    teamDetermination: true,
    fields: [
      { id: "placementOptionsConsidered", label: "Placement option(s) considered", kind: "deterministic", inputType: "text", required: true },
      { id: "removalReason", label: "If removed from general education setting, explain why services cannot be provided there with supports", kind: "deterministic", inputType: "text" },
      { id: "lreDecisionBasis", label: "Document basis for LRE decision(s)", kind: "deterministic", inputType: "text", required: true },
      { id: "preschoolPlacementSummary", label: "Preschool placement summary (age 3-5)", kind: "deterministic", inputType: "text" },
      { id: "schoolAgeLreCategory", label: "School-age placement category (K-21)", kind: "deterministic", inputType: "select", options: LRE_OPTIONS },
      { id: "totalSchoolWeek", label: "Total time in school week", kind: "deterministic", inputType: "text" },
      { id: "timeInsideGeneralEducation", label: "Time inside general education", kind: "deterministic", inputType: "text" },
      { id: "timeOutsideGeneralEducation", label: "Time outside general education", kind: "deterministic", inputType: "text" },
      { id: "averagePercentInsideGeneralEducation", label: "Average %/day inside general education", kind: "deterministic", inputType: "text" },
      { id: "potentialHarmfulEffects", label: "Potential harmful effects on student or service quality", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "servicesInHomeSchool", label: "Services provided in student's home school", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "placementCloseToHome", label: "Placement is as close as possible to student's home", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "transportationRelatedServiceNeeded", label: "Related service transportation needed", kind: "deterministic", inputType: "select", options: YES_NO },
      { id: "transportationSupportsSummary", label: "Transportation supports/equipment/personnel discussion", kind: "deterministic", inputType: "text" },
      { id: "nonDisabledPeersParticipationExplanation", label: "Explanation of any non-participation with non-disabled peers", kind: "deterministic", inputType: "text" },
      { id: "ssisDataSummary", label: "SSIS residence/service county and school summary", kind: "deterministic", inputType: "text" },
      { id: "childCountEligibilityCode", label: "Child count eligibility code", kind: "deterministic", inputType: "text" },
    ],
  },
];
