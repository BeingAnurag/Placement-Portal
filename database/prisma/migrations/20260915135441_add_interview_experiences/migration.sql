-- CreateEnum
CREATE TYPE "InterviewExperienceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "InterviewExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "batch" INTEGER NOT NULL,
    "interviewType" TEXT NOT NULL,
    "dsaQuestions" TEXT,
    "oopsQuestions" TEXT,
    "dbmsQuestions" TEXT,
    "osQuestions" TEXT,
    "cnQuestions" TEXT,
    "sqlQuestions" TEXT,
    "systemDesignQuestions" TEXT,
    "csFundamentalsQuestions" TEXT,
    "resumeQuestions" TEXT,
    "projectsDiscussed" TEXT,
    "codingQuestions" TEXT,
    "aptitudeQuestions" TEXT,
    "hrQuestions" TEXT,
    "behavioralQuestions" TEXT,
    "resources" TEXT,
    "unansweredQuestions" TEXT,
    "tips" TEXT,
    "status" "InterviewExperienceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewExperience_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewExperience" ADD CONSTRAINT "InterviewExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewExperience" ADD CONSTRAINT "InterviewExperience_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
