-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "grade" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATETIME
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "phoneNumber" TEXT,
    "dateOfBirth" DATETIME,
    "preferences" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActive" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "learningStyle" TEXT,
    "preferredDifficulty" TEXT NOT NULL DEFAULT 'medium',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalLearningTime" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "wrongAnswers" INTEGER NOT NULL DEFAULT 0,
    "averageScore" REAL NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "currentMood" TEXT NOT NULL DEFAULT 'neutral',
    "lastMoodUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "averageConfidence" REAL NOT NULL DEFAULT 70,
    "averageEngagement" REAL NOT NULL DEFAULT 80,
    "strugglingTopics" TEXT,
    "masteredTopics" TEXT,
    "recentTopics" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "lastInteractionTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveDate" DATETIME,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "hintsRequested" INTEGER NOT NULL DEFAULT 0,
    "breaksRequested" INTEGER NOT NULL DEFAULT 0,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "conversationHistory" TEXT,
    "preferences" TEXT,
    "achievementPreferences" TEXT,
    "notificationPreferences" TEXT,
    "dailyTarget" INTEGER NOT NULL DEFAULT 3,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "lastParentReport" DATETIME,
    "parentReportFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmotionalState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "mood" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL DEFAULT 0,
    "indicators" TEXT,
    "triggers" TEXT,
    "systemResponse" TEXT,
    "suggestions" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "EmotionalState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "grade" INTEGER NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Unit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "summary" TEXT,
    "keyPoints" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 45,
    "emotionalTones" TEXT,
    "motivationalMessages" TEXT,
    "difficultyVariations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "summary" TEXT,
    "keyPoints" TEXT,
    "examples" TEXT,
    "exercises" TEXT,
    "enrichedContent" TEXT,
    "lastEnrichedAt" DATETIME,
    "enrichmentLevel" INTEGER NOT NULL DEFAULT 0,
    "adaptiveContent" TEXT,
    "emotionalSupport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Content_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "specifications" TEXT,
    "url" TEXT,
    "alternativeText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualElement_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractiveComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InteractiveComponent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentQuality" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "contentScore" INTEGER NOT NULL DEFAULT 0,
    "pedagogicalScore" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "lastAssessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentDetails" TEXT,
    CONSTRAINT "ContentQuality_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Concept_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Example" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT,
    "difficulty" TEXT,
    "visualAid" TEXT,
    "relatedConcept" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Example_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Formula" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expression" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formula_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RAGContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RAGContent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentEmbedding_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "script" TEXT,
    "slides" TEXT,
    "audioUrl" TEXT,
    "processingData" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "order" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDynamic" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "successRate" REAL NOT NULL DEFAULT 0,
    "learningObjective" TEXT,
    "hints" TEXT,
    "stepByStepSolution" TEXT,
    "encouragementMessages" TEXT,
    "errorFeedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" REAL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "timeSpent" INTEGER,
    "completedAt" DATETIME,
    "emotionalState" TEXT,
    "confidenceLevel" REAL NOT NULL DEFAULT 0,
    "stressLevel" REAL NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttemptAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeSpent" INTEGER,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "completionRate" REAL NOT NULL DEFAULT 0,
    "videoWatched" BOOLEAN NOT NULL DEFAULT false,
    "quizCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "lastVideoTime" REAL NOT NULL DEFAULT 0,
    "lastScrollPosition" REAL NOT NULL DEFAULT 0,
    "lastSectionId" TEXT,
    "emotionalJourney" TEXT,
    "struggledSections" TEXT,
    "masteredSections" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "sessionId" TEXT,
    "userMessage" TEXT NOT NULL DEFAULT '',
    "aiResponse" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "metadata" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "emotionalContext" TEXT,
    "wasHelpful" BOOLEAN,
    "isStreaming" BOOLEAN NOT NULL DEFAULT false,
    "responseTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "progress" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimedReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimedReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "progress" REAL NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "points" INTEGER NOT NULL DEFAULT 10,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "socketId" TEXT,
    "currentSlide" INTEGER NOT NULL DEFAULT 0,
    "totalSlides" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "emotionalStates" TEXT,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "hintsRequested" INTEGER NOT NULL DEFAULT 0,
    "breaksTaken" INTEGER NOT NULL DEFAULT 0,
    "focusScore" REAL NOT NULL DEFAULT 0,
    "chatHistory" TEXT,
    "slideHistory" TEXT,
    "userPreferences" TEXT,
    "teachingScripts" TEXT,
    CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentContext_userId_key" ON "StudentContext"("userId");

-- CreateIndex
CREATE INDEX "StudentContext_userId_idx" ON "StudentContext"("userId");

-- CreateIndex
CREATE INDEX "StudentContext_currentMood_idx" ON "StudentContext"("currentMood");

-- CreateIndex
CREATE INDEX "StudentContext_lastInteractionTime_idx" ON "StudentContext"("lastInteractionTime");

-- CreateIndex
CREATE INDEX "EmotionalState_userId_idx" ON "EmotionalState"("userId");

-- CreateIndex
CREATE INDEX "EmotionalState_detectedAt_idx" ON "EmotionalState"("detectedAt");

-- CreateIndex
CREATE INDEX "EmotionalState_mood_idx" ON "EmotionalState"("mood");

-- CreateIndex
CREATE INDEX "Subject_grade_idx" ON "Subject"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_grade_key" ON "Subject"("name", "grade");

-- CreateIndex
CREATE INDEX "Unit_subjectId_idx" ON "Unit"("subjectId");

-- CreateIndex
CREATE INDEX "Lesson_unitId_idx" ON "Lesson"("unitId");

-- CreateIndex
CREATE INDEX "Lesson_isPublished_idx" ON "Lesson"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Content_lessonId_key" ON "Content"("lessonId");

-- CreateIndex
CREATE INDEX "Content_lessonId_idx" ON "Content"("lessonId");

-- CreateIndex
CREATE INDEX "Content_enrichmentLevel_idx" ON "Content"("enrichmentLevel");

-- CreateIndex
CREATE INDEX "VisualElement_lessonId_idx" ON "VisualElement"("lessonId");

-- CreateIndex
CREATE INDEX "InteractiveComponent_lessonId_idx" ON "InteractiveComponent"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentQuality_lessonId_key" ON "ContentQuality"("lessonId");

-- CreateIndex
CREATE INDEX "ContentQuality_lessonId_idx" ON "ContentQuality"("lessonId");

-- CreateIndex
CREATE INDEX "ContentQuality_overallScore_idx" ON "ContentQuality"("overallScore");

-- CreateIndex
CREATE INDEX "Concept_lessonId_idx" ON "Concept"("lessonId");

-- CreateIndex
CREATE INDEX "Example_lessonId_idx" ON "Example"("lessonId");

-- CreateIndex
CREATE INDEX "Formula_lessonId_idx" ON "Formula"("lessonId");

-- CreateIndex
CREATE INDEX "RAGContent_lessonId_idx" ON "RAGContent"("lessonId");

-- CreateIndex
CREATE INDEX "RAGContent_contentType_idx" ON "RAGContent"("contentType");

-- CreateIndex
CREATE INDEX "ContentEmbedding_contentId_idx" ON "ContentEmbedding"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEmbedding_contentId_chunkIndex_key" ON "ContentEmbedding"("contentId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Video_lessonId_key" ON "Video"("lessonId");

-- CreateIndex
CREATE INDEX "Video_lessonId_idx" ON "Video"("lessonId");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Question_lessonId_idx" ON "Question"("lessonId");

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");

-- CreateIndex
CREATE INDEX "Question_isActive_idx" ON "Question"("isActive");

-- CreateIndex
CREATE INDEX "Question_timesUsed_idx" ON "Question"("timesUsed");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_lessonId_idx" ON "QuizAttempt"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttemptAnswer_attemptId_questionId_key" ON "QuizAttemptAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Progress_userId_idx" ON "Progress"("userId");

-- CreateIndex
CREATE INDEX "Progress_lessonId_idx" ON "Progress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_lessonId_key" ON "Progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_lessonId_idx" ON "ChatMessage"("lessonId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_category_idx" ON "UserAchievement"("category");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "ClaimedReward_userId_idx" ON "ClaimedReward"("userId");

-- CreateIndex
CREATE INDEX "DailyChallenge_userId_idx" ON "DailyChallenge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_userId_challengeId_date_key" ON "DailyChallenge"("userId", "challengeId", "date");

-- CreateIndex
CREATE INDEX "LearningSession_userId_idx" ON "LearningSession"("userId");

-- CreateIndex
CREATE INDEX "LearningSession_lessonId_idx" ON "LearningSession"("lessonId");

-- CreateIndex
CREATE INDEX "LearningSession_isActive_idx" ON "LearningSession"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSession_userId_lessonId_key" ON "LearningSession"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
