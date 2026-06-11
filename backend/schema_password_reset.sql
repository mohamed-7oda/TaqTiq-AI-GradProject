-- Run this in SQL Server Management Studio against the GradProject database

CREATE TABLE PasswordResetTokens (
    TokenID   INT           PRIMARY KEY IDENTITY(1,1),
    UserID    INT           NOT NULL,
    Token     NVARCHAR(100) NOT NULL UNIQUE,
    ExpiresAt DATETIME      NOT NULL,
    CreatedAt DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ResetTokens_Users FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE INDEX IX_ResetTokens_Token ON PasswordResetTokens(Token);
