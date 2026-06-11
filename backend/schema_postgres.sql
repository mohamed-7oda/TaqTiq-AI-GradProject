-- PostgreSQL schema for Neon
-- Run this once in the Neon SQL Editor to create all tables

CREATE TABLE IF NOT EXISTS Users (
    UserID       SERIAL        PRIMARY KEY,
    FullName     VARCHAR(200)  NOT NULL,
    Email        VARCHAR(255)  NOT NULL UNIQUE,
    PasswordHash VARCHAR(255)  NOT NULL
);

CREATE TABLE IF NOT EXISTS UserProfiles (
    ProfileID    SERIAL        PRIMARY KEY,
    UserID       INT           NOT NULL UNIQUE,
    PhoneNumber  VARCHAR(30),
    DateOfBirth  DATE,
    Country      VARCHAR(100),
    City         VARCHAR(100),
    Organization VARCHAR(200),
    Role         VARCHAR(100),
    Bio          VARCHAR(500),
    UpdatedAt    TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT FK_Profiles_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AnalysisHistory (
    HistoryID       SERIAL        PRIMARY KEY,
    UserID          INT           NOT NULL,
    JobID           VARCHAR(50)   NOT NULL,
    VideoFileName   VARCHAR(255)  NOT NULL,
    Mode            VARCHAR(20)   NOT NULL,
    TotalEvents     INT,
    EventCountsJSON TEXT,
    ResultsJSON     TEXT,
    AnalyzedAt      TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT FK_History_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_History_User ON AnalysisHistory(UserID, AnalyzedAt DESC);

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    TokenID   SERIAL        PRIMARY KEY,
    UserID    INT           NOT NULL,
    Token     VARCHAR(100)  NOT NULL UNIQUE,
    ExpiresAt TIMESTAMP     NOT NULL,
    CreatedAt TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT FK_ResetTokens_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_ResetTokens_Token ON PasswordResetTokens(Token);

CREATE TABLE IF NOT EXISTS AnalysisTags (
    TagID      SERIAL        PRIMARY KEY,
    UserID     INT           NOT NULL,
    HistoryID  INT           NOT NULL,
    Label      VARCHAR(100)  NOT NULL,
    CreatedAt  TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT FK_Tags_History FOREIGN KEY (HistoryID)
        REFERENCES AnalysisHistory(HistoryID) ON DELETE CASCADE,
    CONSTRAINT UQ_AnalysisTags_Unique UNIQUE (UserID, HistoryID, Label)
);

CREATE TABLE IF NOT EXISTS MatchNotes (
    NoteID     SERIAL        PRIMARY KEY,
    HistoryID  INT           NOT NULL,
    UserID     INT           NOT NULL,
    NoteText   TEXT          NOT NULL,
    CreatedAt  TIMESTAMP     NOT NULL DEFAULT NOW(),
    UpdatedAt  TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT FK_Notes_History FOREIGN KEY (HistoryID)
        REFERENCES AnalysisHistory(HistoryID) ON DELETE CASCADE
);
