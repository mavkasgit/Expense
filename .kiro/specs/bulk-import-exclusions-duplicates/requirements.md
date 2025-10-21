# Requirements Document

## Introduction

Система обнаружения дубликатов и исключений для массового импорта расходов из банковских выписок. Функционал позволяет пользователям автоматически исключать нежелательные транзакции и обнаруживать дубликаты как внутри импортируемого файла, так и среди существующих расходов в базе данных.

## Glossary

- **Bulk_Import_System**: Система массового импорта расходов из файлов
- **Exclusion_Rule**: Правило исключения, содержащее ключевое слово или фразу для фильтрации
- **Duplicate_Detection_Engine**: Механизм обнаружения дубликатов расходов
- **Import_Row**: Строка данных из импортируемого файла
- **Existing_Expense**: Расход, уже сохраненный в базе данных пользователя
- **Match_Criteria**: Критерии сопоставления для определения дубликатов
- **Exclusion_Manager**: Интерфейс управления правилами исключений
- **Duplicate_Resolution_Interface**: Интерфейс разрешения конфликтов дубликатов

## Requirements

### Requirement 1

**User Story:** Как пользователь, я хочу создавать правила исключений по ключевым словам, чтобы автоматически отфильтровывать нежелательные транзакции при импорте

#### Acceptance Criteria

1. THE Exclusion_Manager SHALL provide interface for creating new exclusion rules
2. WHEN user creates exclusion rule, THE Exclusion_Manager SHALL validate keyword is not empty
3. THE Exclusion_Manager SHALL store exclusion rules persistently for user
4. THE Exclusion_Manager SHALL allow editing existing exclusion rules
5. THE Exclusion_Manager SHALL allow deleting exclusion rules

### Requirement 2

**User Story:** Как пользователь, я хочу чтобы система автоматически исключала строки содержащие мои ключевые слова, чтобы не импортировать ненужные транзакции

#### Acceptance Criteria

1. WHEN Import_Row is processed, THE Bulk_Import_System SHALL check all fields against exclusion rules
2. IF Import_Row contains excluded keyword, THEN THE Bulk_Import_System SHALL mark row as excluded
3. THE Bulk_Import_System SHALL provide visual indication of excluded rows
4. THE Bulk_Import_System SHALL allow user to override exclusion for specific rows
5. THE Bulk_Import_System SHALL count and display number of excluded rows

### Requirement 3

**User Story:** Как пользователь, я хочу обнаруживать дубликаты внутри импортируемого файла, чтобы избежать создания повторяющихся записей

#### Acceptance Criteria

1. THE Duplicate_Detection_Engine SHALL compare Import_Row entries within same import session
2. WHEN duplicate is detected within import, THE Duplicate_Detection_Engine SHALL mark both rows as potential duplicates
3. THE Duplicate_Detection_Engine SHALL use configurable Match_Criteria for comparison
4. THE Duplicate_Detection_Engine SHALL highlight duplicate rows visually
5. THE Duplicate_Detection_Engine SHALL allow user to select which duplicate to keep

### Requirement 4

**User Story:** Как пользователь, я хочу обнаруживать дубликаты с существующими расходами в базе данных, чтобы не создавать повторные записи

#### Acceptance Criteria

1. THE Duplicate_Detection_Engine SHALL compare Import_Row against Existing_Expense records
2. WHEN potential duplicate with existing expense is found, THE Duplicate_Detection_Engine SHALL mark Import_Row as duplicate
3. THE Duplicate_Detection_Engine SHALL display existing expense details for comparison
4. THE Duplicate_Detection_Engine SHALL allow user to choose whether to import or skip duplicate
5. THE Duplicate_Detection_Engine SHALL provide batch actions for handling multiple duplicates

### Requirement 5

**User Story:** Как пользователь, я хочу настраивать критерии сопоставления дубликатов, чтобы контролировать точность обнаружения

#### Acceptance Criteria

1. THE Match_Criteria SHALL include amount comparison with configurable tolerance
2. THE Match_Criteria SHALL include date comparison with configurable range
3. THE Match_Criteria SHALL include description text similarity comparison
4. THE Match_Criteria SHALL allow enabling or disabling individual criteria
5. THE Match_Criteria SHALL be saved as user preferences

### Requirement 6

**User Story:** Как пользователь, я хочу видеть сводку исключений и дубликатов перед импортом, чтобы принять обоснованное решение

#### Acceptance Criteria

1. THE Duplicate_Resolution_Interface SHALL display summary of excluded rows count
2. THE Duplicate_Resolution_Interface SHALL display summary of duplicate rows count
3. THE Duplicate_Resolution_Interface SHALL show breakdown by exclusion rules
4. THE Duplicate_Resolution_Interface SHALL show breakdown by duplicate types
5. THE Duplicate_Resolution_Interface SHALL allow proceeding with filtered import

### Requirement 7

**User Story:** Как пользователь, я хочу управлять исключенными и дублированными строками в интерфейсе таблицы, чтобы иметь полный контроль над импортом

#### Acceptance Criteria

1. THE Bulk_Import_System SHALL provide filter to show only excluded rows
2. THE Bulk_Import_System SHALL provide filter to show only duplicate rows
3. THE Bulk_Import_System SHALL allow bulk actions on filtered rows
4. THE Bulk_Import_System SHALL provide visual indicators for row status
5. THE Bulk_Import_System SHALL update counters when row status changes