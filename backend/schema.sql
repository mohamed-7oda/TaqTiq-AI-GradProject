-- Run these statements in SQL Server Management Studio against the GradProject database.

-- ── Extended profile data for each user ──────────────────────────────────────
CREATE TABLE UserProfiles (
    ProfileID    INT           PRIMARY KEY IDENTITY(1,1),
    UserID       INT           UNIQUE NOT NULL,
    PhoneNumber  NVARCHAR(30)  NULL,
    DateOfBirth  DATE          NULL,
    Country      NVARCHAR(100) NULL,
    City         NVARCHAR(100) NULL,
    Organization NVARCHAR(200) NULL,   -- club / university / company
    Role         NVARCHAR(100) NULL,   -- Analyst, Coach, Scout, Researcher …
    Bio          NVARCHAR(500) NULL,
    UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Profiles_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

-- ── Persisted record of every completed analysis ──────────────────────────────
CREATE TABLE AnalysisHistory (
    HistoryID       INT            PRIMARY KEY IDENTITY(1,1),
    UserID          INT            NOT NULL,
    JobID           NVARCHAR(50)   NOT NULL,
    VideoFileName   NVARCHAR(255)  NOT NULL,
    Mode            NVARCHAR(20)   NOT NULL,   -- 'events' | 'tracking'
    TotalEvents     INT            NULL,        -- events mode only
    EventCountsJSON NVARCHAR(MAX)  NULL,        -- {"Goal":2,"Foul":8,...}
    ResultsJSON     NVARCHAR(MAX)  NULL,        -- full serialised result
    AnalyzedAt      DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_History_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE INDEX IX_History_User ON AnalysisHistory(UserID, AnalyzedAt DESC);
