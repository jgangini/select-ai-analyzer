# Graph Report - codex-select-ai  (2026-05-11)

## Corpus Check
- 255 files · ~111,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2245 nodes · 4092 edges · 112 communities (102 shown, 10 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 627 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4932c4f2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]

## God Nodes (most connected - your core abstractions)
1. `DashboardService` - 27 edges
2. `_question_has_any()` - 27 edges
3. `SelectAIDataSourceMixin` - 26 edges
4. `2026-03-18` - 26 edges
5. `_sql_generation_hints()` - 25 edges
6. `_fallback_sql_for_question()` - 24 edges
7. `ConfigService` - 24 edges
8. `SettingsService` - 23 edges
9. `DatabaseManager` - 20 edges
10. `_score_domain_intents()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `test_source_parser_skips_missing_objects_and_deduplicates()` --calls--> `parse_source_tables()`  [INFERRED]
  apps/backend/tests/test_source_parser.py → scripts/source_seed_parser.py
- `test_write_seed_files_creates_csv_and_metadata_sidecar()` --calls--> `write_seed_files()`  [INFERRED]
  apps/backend/tests/test_source_seed_loader.py → scripts/source_seed_synthetic.py
- `test_convert_csv_value_uses_oracle_column_type()` --calls--> `convert_csv_value()`  [INFERRED]
  apps/backend/tests/test_source_seed_script_helpers.py → scripts/source_seed_values.py
- `test_convert_csv_value_rejects_bad_dates_and_numbers()` --calls--> `convert_csv_value()`  [INFERRED]
  apps/backend/tests/test_source_seed_script_helpers.py → scripts/source_seed_values.py
- `test_runtime_connection_config_requires_complete_json()` --calls--> `runtime_connection_config()`  [INFERRED]
  apps/backend/tests/test_source_seed_script_helpers.py → scripts/source_seed_runtime.py

## Communities (112 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (54): ColumnMetadataRequest, create_schema(), CreateSchemaRequest, delete_data_source(), describe_catalog_table(), ExistingTableRequest, list_catalog_owners(), list_catalog_tables() (+46 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (74): _is_balance_history_source(), _is_branch_dates_source(), _is_customer_account_source(), _is_daily_log_source(), _is_external_statement_source(), _is_external_transactions_source(), _is_hidden_statement_source(), _is_interest_processing_table() (+66 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (59): AddVisualizationButton(), ChartControls(), ChartControlsProps, ChartScrollbarState, ChartScrollFrame(), ChartSortMode, chartRendererTools, ResultTableRenderer (+51 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (30): SelectAIDataSourceMixin, _data_source_from_cursor(), SelectAIDataSourcePreviewMixin, _source_column_details(), SelectAIDataSourceCatalogMixin, SelectAIDataSourceCsvMixin, SelectAIDataSourceMetadataMixin, SelectAIDataSourceMixin (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (50): api, token, ConnectionAliasField(), ConnectionAliasFieldProps, DatabaseSetupNotice(), WalletUploadField(), WalletUploadFieldProps, WizardPasswordField() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (56): main(), build_create_table_sql(), _normalize_identifier(), oracle_type_for_ddl(), parse_source_tables(), Parse SQL*Plus DESC output from .source into table metadata.      Blocks with SQ, SourceColumn, SourceTable (+48 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (52): ConversationSummary, escapeRegExp(), highlightSearchMatch(), buildConversationMarkdown(), ConversationDetailForExport, ConversationMessageForExport, ConversationSummaryForSort, formatDateTime() (+44 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (48): appendUniqueTableRef(), baseInspection(), buildAnswerInspection(), buildExecuteInspection(), buildGraphBounds(), buildGraphEdges(), buildGraphNodes(), buildGraphViewBox() (+40 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (30): Protocol, AvatarFile, AvatarStorage, AvatarValidationError, media_type(), _coerce_suggested_questions(), _compact_suggested_questions(), _default_payload() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (42): BootstrapDatabaseMixin, BootstrapOciMixin, BootstrapScriptMixin, BootstrapStatusMixin, decode_access_token(), get_current_user(), get_password_hash(), get_settings() (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (42): _chunks(), _connect(), load_source_seed(), _load_table(), main(), _runtime_db_config_path(), assert_connected_schema(), drop_table_if_exists() (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (19): BaseSettings, get_settings(), When `_env_file=None` is explicit, force defaults/init values only., Settings, create_access_token(), get_auth_service(), get_current_user_info(), login() (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (21): change_password(), ChangePasswordRequest, create_user(), CreateUserRequest, current_user_id(), delete_user(), get_current_user_info(), get_user_service() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (28): Profile(), ProfileFormData, currentUser, usersApiMock, emptyUserForm, UsersAuthUser, ChangePasswordPayload, CreateUserPayload (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (17): BootstrapStatusMixin, check_setup_status(), Lightweight setup-status reader used by runtime guards., SetupStatusService, from_runtime(), DbManager, FakeConnection, FakeCursor (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (27): build_oci_client_config(), build_oracle_connection_kwargs(), missing_required_oci_config_keys(), open_runtime_database_connection(), parse_bootstrap_sql_statements(), read_private_key_for_db_credential(), resolve_backend_root(), resolve_bootstrap_sql_dir() (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (25): extract_zip_safely(), safe_upload_name(), check_setup_status(), complete_setup(), execute_setup(), get_setup_service(), _has_complete_database_config(), list_genai_models() (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (23): DataSourcePreviewModal(), DataSourcePreviewModalProps, DataSourcesTable(), DataSourcesTableProps, Pagination(), buildPreviewColumnDetails(), DataSourceColumnMetadata, dataSourceStatusBadgeClassNames (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (24): DataSourceCatalogTableDetail, EMPTY_DATA_SOURCES, filterDataSources(), metadataWarningMessage(), summarizeDataSources(), DataSourceApiForMutations, DataSourceColumnMetadata, DataSourceMutationListState (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (27): 2026-03-18, Avatar del agente en chat (fallback por letra), Batería de 21 preguntas RAG (script de evaluación), Batería RAG: carpetas RM797, progreso y ETA, Batería RAG: corrida completa 2026-03-20 (2 carpetas, 42 preguntas), Batería RAG: modo secuencial por carpeta (`--workers 1`), Cambio de conexión Oracle: `HIGH` -> `MEDIUM`, DELETE /api/files/{id} -> 500 (FK monitorings) (+19 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (22): AddDashboardItemsPayload, AddDashboardStep, ApiResponse, CreateDashboardPayload, DashboardChartSpec, DashboardDetail, DashboardDraftItem, DashboardDraftTargetState (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (21): AnalyticsChatComposerProps, AnalyticsChatHeaderProps, AssistantChatListMessage, ChatListMessage, ChatMessageBubble(), formatTime(), AnalyticsDashboardHeader(), AnalyticsDashboardTabs() (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (17): DashboardItemMutationMixin, _dashboard_item_insert_params(), _dashboard_item_update_fields(), _json_object_literal(), _normalize_dashboard_item_ids(), _normalize_dashboard_items(), _normalize_required_text(), _dashboard_exists_for_owner() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (20): AdminPasswordRequest, DBRuntimeConfigRequest, DBTestRequest, GenerativeAIConfigRequest, ObjectStorageTestRequest, OCIConfigRequest, SetupRequest, WalletDSNRequest (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (19): compactQuestions(), DEFAULT_SUGGESTED_QUESTIONS, normalizeSuggestedQuestionRecord(), normalizeSuggestedQuestions(), replaceSuggestedQuestionAt(), resolveSuggestedQuestions(), selectInitialSuggestedQuestions(), selectRandomSuggestedQuestions() (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (20): apply_doc_example_overrides(), _set_if_present(), _apply_balance_history_example(), apply_core_doc_example_overrides(), _apply_customer_account_examples(), _apply_customer_account_row(), _apply_customer_examples(), _apply_daily_log_examples() (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (21): Analytics, AnalyticsChatPanel, AppRoutes(), authenticatedRoutes(), DataSources, Home, LoginForm, Profile (+13 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (9): DatabaseManager, _missing_required_config(), Initialize connection pool (thin mode, no Oracle Client)., Get connection from pool., Close pool (on shutdown)., Return whether a table exists in the current schema., Persist DB connection chosen in setup wizard., Singleton to manage connection pool to Autonomous Database. (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (20): AnalyticsAskRequest, AnalyticsAskResponse, AnalyticsConversationClient, AnalyticsConversationDetail, analyticsConversationQueryKey(), AnalyticsConversationSummary, ApiResponse, AskQuestionVariables (+12 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (20): BaseHTTPMiddleware, checkpoint(), _duration_ms(), _ensure_trace_file(), _enter_trace(), _exception_trace(), _exit_trace(), get_trace_id() (+12 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (7): SelectAIConversationMixin, ConversationService, RecordingConnection, RecordingCursor, test_record_question_run_commits_conversation_before_insert(), test_record_question_run_rejects_other_users_conversation(), test_resolve_oracle_conversation_id_requires_writable_conversation()

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (7): BaseConnection, BaseCursor, BaseDbManager, FakeLob, test_profile_name_reads_config_value_and_lobs(), test_profile_name_uses_default_when_config_table_is_missing(), test_refresh_profile_calls_profile_procedure()

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (17): DashboardItemMoveUpdate, isDragBlockedTarget(), DragSession, ShowToast, AddDashboardItemsPayload, ChartSpec, CreateDashboardPayload, DashboardDetail (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (16): DataDictionaryEditor(), DataSourceColumnMetadata, onColumnChange, onTableCommentChange, DataSourceObjectModal(), DataSourceObjectModalProps, ModalProps, onObjectModeChange (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (8): make_service(), MutationConnection, MutationCursor, MutationDbManager, test_add_dashboard_items_inserts_normalized_visualization(), test_add_dashboard_items_rejects_empty_dashboard_id_or_items(), test_reorder_dashboard_items_rejects_duplicate_items_before_opening_connection(), test_update_dashboard_item_rejects_invalid_layout_before_opening_connection()

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (8): _normalize_visibility(), FakeLob, SchemaConnection, SchemaDbManager, test_ensure_tables_creates_dashboard_schema_and_commits(), test_json_loads_reads_lobs_and_uses_default_for_null(), test_normalize_visibility_defaults_and_accepts_known_values(), test_normalize_visibility_rejects_unknown_values()

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (11): DbManager, FakeBootstrapOciService, FakeConnection, Settings, test_complete_setup_marks_wizard_done_and_regenerates_runtime_config(), test_generative_ai_validation_normalizes_url_and_allows_http_status_errors(), test_generative_ai_validation_reports_unreachable_endpoint(), test_generative_ai_validation_requires_endpoint_before_network() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (19): DashboardLayoutItem, getDashboardItemColumn(), getDashboardItemMoveUpdate(), getVisualizationWidth(), container, createDashboardElement(), createGrid(), elementFromPointMock (+11 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (18): buildDropPosition(), buildEdgeDropPosition(), buildRowGapPosition(), DropPositionInput, EMPTY_DROP_POSITION, findDashboardItemIndex(), findOpenRowElement(), getDashboardItemElements() (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (14): Footer(), buildInstallErrorMessage(), InstallationData, InstallationResult, InstallationStep(), Props, SetupScriptError, renderStep() (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (18): AnalyticsChatMessage, AnalyticsChatResult, AnalyticsConversationForMessages, buildConversationMessages(), buildDashboardDraftItem(), findLatestAssistantMessage(), findLatestMessage(), findLatestUserQuestion() (+10 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (18): SqlIcon(), AnalyticsVisualizationCard(), AnalyticsVisualizationCardProps, formatCellValue(), getInsertionLineClass(), getMetricLabel(), CardProps, item (+10 more)

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (13): SearchChatsModal(), analyticsApiMock, conversation, deleteOverlay, OpenSearchButton(), SearchChatsProbe(), searchOverlay, AnalyticsChatContext (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (14): checkSetupComplete(), readAppSetting(), resolveAgentName(), resolveApplicationName(), resolveSuggestedQuestions(), settingsApi, settingsQueryKeys, setupQueryKeys (+6 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (9): RuntimeError, BootstrapOciMixin, _oci_file_values(), _upsert_config_items(), normalize_oci_config_rows(), normalize_oci_config_value(), ReadableValue, test_normalize_oci_config_rows_strips_prefix_and_reads_values() (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.15
Nodes (6): _created_profile_attributes(), FakeLob, ScopedProfileConnection, ScopedProfileCursor, test_create_scoped_profile_rejects_missing_genai_model(), test_create_scoped_profile_uses_configured_genai_model()

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (16): onClose, onPageChange, PreviewProps, { rerender }, response, source, csvSource, onDelete (+8 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (6): FakeConnection, FakeCursor, FakeDbManager, test_get_value_reads_config_in_one_connection(), test_get_value_returns_default_when_config_table_is_missing(), test_get_value_returns_default_when_connection_is_unavailable()

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (12): _json_dump(), _analytics_conversation_exists(), _delete_analytics_conversation(), _delete_question_runs(), _insert_question_run(), _insert_question_run_snapshot(), _rename_analytics_conversation(), _select_conversation_summary() (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (14): ChartPreview(), AddDashboardStep, AnalyticsAddVisualizationModal(), AnalyticsDashboardTray(), AnalyticsDeleteChatModal(), DashboardChartSpec, DashboardDraftItem, DashboardSummary (+6 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (13): ToastProbe(), ToastContext, ToastContextType, ToastItem, ToastProvider(), ToastViewport(), useToast(), SelectAIServicesStep() (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.14
Nodes (7): SelectAIGenerationMixin, SelectAIAnalyticsService, SelectAIAskMixin, SelectAIBaseService, SelectAIGenerationMixin, SelectAIScopedProfileMixin, ScopedProfileService

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (15): mergeMetadataWithColumns(), schemaNeedsCreation(), sortCatalogTables(), sortSchemaOptions(), csvInput, csvReady, details, filtered (+7 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (11): DraftConversationPreview, ActionMenuItem, ChatScrollbarState, ChatStatusIndicator(), formatRelativeUpdatedAt(), MenuItem, parseTimestamp(), RouteMenuItem (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (12): AuthClient, AuthContext, AuthContextType, AuthProvider(), AuthQueryKeys, AuthUser, authClient, AuthProbe() (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.21
Nodes (7): config_status(), health(), AppStatusService, FakeConfigService, FakeSettings, test_config_status_reports_select_ai_and_storage_state(), test_health_status_uses_runtime_model_default()

### Community 56 - "Community 56"
Cohesion: 0.2
Nodes (11): _assert_conversation_writable(), _materialize_stored_result(), _open_cursor(), _safe_max_rows(), SelectAIConversationMixin, SelectAIConversationMutationMixin, _transaction_cursor(), _select_conversation_list() (+3 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (14): CloudTechNext, code:bash (docker run -d \), code:powershell (py -3 scripts\generate_source_seed.py --default-rows 365 --f), code:powershell (.\scripts\dev.ps1), code:powershell (.\scripts\dev.ps1 -InstallFrontendDeps), code:powershell (.\scripts\check-project.ps1 -InstallDeps), code:powershell (.\scripts\check-project.ps1), Docker (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.24
Nodes (4): ConfigService, _is_missing_config_table_error(), _normalize_value(), Persist runtime configuration in the `config` table.

### Community 59 - "Community 59"
Cohesion: 0.18
Nodes (5): execute_read_only_select(), FakeConnection, FakeCursor, test_execute_read_only_select_rejects_mutating_sql_before_opening_connection(), test_execute_read_only_select_validates_and_serializes_rows()

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (10): DashboardModalDashboard, DashboardModalItem, DeleteDashboardModal(), DeleteVisualizationModal(), RenameDashboardModal(), RenameVisualizationModal(), SqlModal(), onClose (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (11): DataSourceColumnMetadata, DataSourceObjectFormHelpers, DataSourceObjectFormState, DataSourceObjectMode, ParsedMetadata, ShowToast, file, formHelpers (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.15
Nodes (11): AssistantAnalyticsResult, AssistantChartSpec, AssistantResult(), DashboardDraftItem, ConfirmDeleteModalProps, ConfirmModal(), ConfirmModalProps, ConfirmQuestionModal() (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.22
Nodes (7): SelectAIDataSourceCatalogMixin, _assert_catalog_table_selectable(), _select_catalog_columns(), _select_catalog_owners(), _select_catalog_table_comment(), _select_catalog_tables(), _select_data_sources()

### Community 64 - "Community 64"
Cohesion: 0.24
Nodes (11): _analytics_http_exception(), ask_analytics(), AskAnalyticsRequest, delete_analytics_conversation(), get_analytics_conversation(), get_question_recommendations(), list_analytics_conversations(), rename_analytics_conversation() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (12): AddVisualizationProps, draftItem, onBack, onCancel, onClose, onConfirm, onDashboardIdChange, onDashboardNameChange (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.17
Nodes (7): analytics, analyticsResult, ConversationStateProbe(), dataSources, dataSourcesClient(), pendingAsk, { result }

### Community 67 - "Community 67"
Cohesion: 0.44
Nodes (11): add_dashboard_items(), create_dashboard(), _current_user_id(), delete_dashboard(), delete_dashboard_item(), get_dashboard(), list_dashboards(), reorder_dashboard_items() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.23
Nodes (7): _alter_if_missing(), _create_if_missing(), DashboardSchemaMixin, SchemaCursor, test_alter_if_missing_ignores_existing_column_or_constraint_errors(), test_create_if_missing_ignores_existing_object_error(), test_schema_helpers_reraise_unexpected_errors()

### Community 69 - "Community 69"
Cohesion: 0.27
Nodes (7): _failure_result(), _generative_model_options(), _inference_test_url(), _missing_saved_config_result(), _probe_inference_endpoint(), _read_key_file_content(), _success_result()

### Community 70 - "Community 70"
Cohesion: 0.2
Nodes (4): Raised when the configured model provider reports temporary capacity exhaustion., SelectAIModelCapacityError, CapacityFallbackAskService, test_ask_uses_deterministic_sql_when_model_capacity_is_exhausted()

### Community 71 - "Community 71"
Cohesion: 0.17
Nodes (11): AnalyticsChatComposer(), AnalyticsChatHeader(), composer, onChange, onDeleteRequest, onRefreshQuestion, onRenameDraftChange, onSelect (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.2
Nodes (6): AnalyticsDashboardSurface(), { rerender }, SurfaceProps, LoadingState(), LoadingStateProps, SIZE_STYLES

### Community 73 - "Community 73"
Cohesion: 0.18
Nodes (9): DataSourceListHelpers, DataSourceListState, DataSourceStats, DataSourceSummary, listHelpers, { rerender, result }, { result }, Source (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (7): DataSourceDeleteConfirmModal(), DataSourceSchemaCreationConfirmModal(), DataSourceStats, DataSources(), metricToneClassNames, ShowToast, dataSourcesControllerMock

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (7): DashboardQueryMixin, _json_loads(), _materialize_stored_result(), _safe_max_rows(), _select_dashboard(), _select_dashboard_items(), _select_dashboards()

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (10): delete_agent_avatar(), get_agent_avatar(), get_public_settings_payload(), get_settings_payload(), get_settings_service(), reset_settings(), settings_status(), SettingsUpdateRequest (+2 more)

### Community 77 - "Community 77"
Cohesion: 0.27
Nodes (5): _require_profile_config_value(), SelectAIScopedProfileMixin, _drop_select_ai_profile(), _select_profile_config(), _select_registered_source_objects()

### Community 78 - "Community 78"
Cohesion: 0.4
Nodes (9): build_uvicorn_kwargs(), emit_startup_banner(), main(), parse_args(), Development runner for the backend server., resolve_reload_dirs(), resolve_reload_excludes(), resolve_repo_root() (+1 more)

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (8): ChartSpec, infer_chart_spec(), _is_number(), validate_chart_spec(), test_starter_suggested_questions_have_chartable_results(), test_infer_chart_spec_prefers_bar_for_category_and_number(), test_infer_chart_spec_uses_bar_for_single_row_numeric_comparison(), test_validate_chart_spec_rejects_unknown_columns()

### Community 80 - "Community 80"
Cohesion: 0.27
Nodes (8): BootstrapScriptMixin, execute_setup_scripts(), no_setup_scripts_result(), schema_guard_result(), is_ignorable_bootstrap_sql_error(), test_no_setup_scripts_result_includes_discovered_files_and_directory(), test_schema_guard_result_reports_connected_user(), test_is_ignorable_bootstrap_sql_error_matches_idempotent_oracle_errors()

### Community 82 - "Community 82"
Cohesion: 0.39
Nodes (7): build_question_recommendations(), compact_questions(), normalize_question_text(), _read_usage_value(), test_build_question_recommendations_prioritizes_unused_for_new_chat_and_usage_for_home(), test_compact_questions_removes_blank_and_duplicate_questions(), test_normalize_question_text_ignores_case_spacing_and_question_marks()

### Community 83 - "Community 83"
Cohesion: 0.36
Nodes (7): extract_sql_statement(), strip_sql_comments(), validate_read_only_select(), test_validate_read_only_select_accepts_single_fenced_select(), test_validate_read_only_select_accepts_single_select(), test_validate_read_only_select_rejects_select_ai_error_text(), test_validate_read_only_select_rejects_unsafe_sql()

### Community 84 - "Community 84"
Cohesion: 0.28
Nodes (4): _archive_dashboard(), _insert_dashboard(), _update_dashboard(), DashboardMutationMixin

### Community 85 - "Community 85"
Cohesion: 0.28
Nodes (6): AppBrand(), AppBrandProps, Header(), HeaderProps, Layout(), LayoutProps

### Community 86 - "Community 86"
Cohesion: 0.42
Nodes (6): getLoginErrorMessage(), LoginForm(), makeMonochromeOracleSvg(), oracleServices, reviewSignals, login

### Community 87 - "Community 87"
Cohesion: 0.25
Nodes (5): Block runtime operations until the setup wizard has completed., require_setup_completed(), get_db_manager(), Helpers de sesion/conexion para FastAPI., Retorna singleton de DatabaseManager.

### Community 88 - "Community 88"
Cohesion: 0.36
Nodes (6): _select_conversation_header(), _select_question_runs(), _json_loads(), _json_safe(), _read_lob(), _rows_as_dicts()

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (5): get_oci_bucket_name(), get_oci_namespace(), Read OCI-related configuration from config table., Get OCI namespace from config table., Get single Object Storage bucket name from config table.

### Community 91 - "Community 91"
Cohesion: 0.6
Nodes (5): Get-ListeningProcessIds(), Get-MatchingProcessIds(), Get-ProcessRecord(), Get-WorkspaceRoot(), Stop-DevProcesses()

### Community 94 - "Community 94"
Cohesion: 0.4
Nodes (4): parse_tns_aliases(), select_preferred_wallet_dsn(), test_parse_tns_aliases_returns_unique_aliases_in_file_order(), test_select_preferred_wallet_dsn_prefers_medium_alias()

### Community 95 - "Community 95"
Cohesion: 0.67
Nodes (3): Graphify, Repository Agent Instructions, Tool Usage

### Community 96 - "Community 96"
Cohesion: 0.5
Nodes (3): Bootstrap SQL, Notes, Standard

## Knowledge Gaps
- **441 isolated node(s):** `Top-level package marker for Docker runtime imports.`, `FastAPI entrypoint for Select AI Analytics.`, `Block runtime operations until the setup wizard has completed.`, `When `_env_file=None` is explicit, force defaults/init values only.`, `Persist DB connection chosen in setup wizard.` (+436 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DatabaseManager` connect `Community 27` to `Community 8`, `Community 11`, `Community 12`, `Community 14`, `Community 81`, `Community 23`, `Community 55`, `Community 58`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `SelectAIBaseService` connect `Community 81` to `Community 0`, `Community 3`, `Community 45`, `Community 51`, `Community 27`, `Community 31`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `DashboardService` connect `Community 23` to `Community 34`, `Community 35`, `Community 68`, `Community 75`, `Community 84`, `Community 22`, `Community 27`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `ValueError` (e.g. with `.load()` and `.save()`) actually correct?**
  _`ValueError` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `DashboardService` (e.g. with `DashboardItemRequest` and `DashboardCreateRequest`) actually correct?**
  _`DashboardService` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `SelectAIDataSourceMixin` (e.g. with `SelectAIBaseService` and `SelectAIDataSourceCatalogMixin`) actually correct?**
  _`SelectAIDataSourceMixin` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Top-level package marker for Docker runtime imports.`, `FastAPI entrypoint for Select AI Analytics.`, `Block runtime operations until the setup wizard has completed.` to the rest of the system?**
  _441 weakly-connected nodes found - possible documentation gaps or missing edges._