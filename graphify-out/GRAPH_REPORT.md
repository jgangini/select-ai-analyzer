# Graph Report - select-ai-analyzer  (2026-08-17)

## Corpus Check
- 281 files · ~108,256 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2446 nodes · 5538 edges · 157 communities (121 shown, 36 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 331 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f97e12d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- analyticsChartUtils.ts
- source_intents.py
- test_source_seed_script_helpers.py
- SelectAIDataSourceService
- SelectAISetupSections.tsx
- source_seed_synthetic.py
- oracleAgentGraphModel.ts
- SettingsService
- AuthService
- SetupStatusService
- UserService
- analytics.py
- DataSourcePreviewModal.tsx
- Users.tsx
- conversation_operations.py
- test_dashboard_support.py
- dashboardDropPosition.ts
- trace
- AnalyticsChatPanel.tsx
- useDataSourcesController.ts
- variables.tf
- DataSourceObjectModal.tsx
- test_bootstrap_database_service.py
- test_bootstrap_oci_service.py
- Settings.tsx
- ValueError
- Analytics.tsx
- useDataSourceObjectForm.ts
- _set_if_present
- usersApi.ts
- test_bootstrap_support.py
- devDependencies
- AppRoutes.tsx
- DatabaseManager
- useAnalyticsConversationState.ts
- AnalyticsDashboardModals.tsx
- dependencies
- _json_safe
- validate_chart_spec
- analyticsChatPanelUtils.ts
- AnalyticsChatPanelParts.tsx
- DashboardService
- SetupWizard.tsx
- test_data_source_helpers.py
- useAnalyticsDashboardDraft.ts
- AnalyticsChatContext.tsx
- App.tsx
- bootstrap_support.py
- datetime
- dataSourceUtils.ts
- SelectAIBaseService
- dashboardDropPosition.test.ts
- analyticsApi.ts
- FakeCursor
- useDataSourceMutations.ts
- SearchChatsModal.tsx
- dataSourcesApi.ts
- ToastContext.tsx
- LoginForm.tsx
- HTTPException
- AppStatusService
- SelectAIDataSourcePreviewMixin
- Sidebar.tsx
- AuthContext.tsx
- validate_read_only_select
- bootstrap_script_service.py
- execute_read_only_select
- CapacityExhaustedDuringNarrateAskService
- Settings
- SelectAIDataSourceSchemaMixin
- routes/dashboards.py
- FakeCursor
- dashboard_mutations.py
- scripts
- data_source_csv.py
- package.json
- user_data.sh
- FakeLob
- SelectAIBaseService
- .terraform.lock.hcl
- dev_reinstall_oracle.py
- DataSources.tsx
- server_runner.py
- _materialize_stored_result
- security.py
- postcss
- _safe_identifier
- @testing-library/react
- @types/react
- vitest
- RuntimeDBConfigStore
- SelectAIServicesStep.tsx
- source_seed_sidecar.py
- AnalyticsVisualizationCard.tsx
- AnalyticsDashboardSurface.tsx
- scoped_profile_operations.py
- terraform/README.md
- compilerOptions
- DatabaseConfigStep.tsx
- dev-cleanup.ps1
- main.py
- _score_source_match
- configure_app.sh
- Bootstrap SQL
- test_conversation_operations.py
- __init__.py
- backend/README.md
- frontend/README.md
- users.py
- tracing.py
- service.py
- source_seed_parser.py
- Select AI Analytics
- Layout.tsx
- compilerOptions
- Local Codex Policy for select-ai-analyzer
- DeployStudioContractTests
- ConfigService
- Repository Agent Instructions
- Improvement Log - select-ai-analyzer
- start.sh
- BootstrapDatabaseMixin
- BootstrapOciMixin
- BootstrapScriptMixin
- BootstrapStatusMixin
- DashboardItemMutationMixin
- DashboardMutationMixin
- DashboardQueryMixin
- DashboardSchemaMixin
- SelectAIAnalyticsService
- SelectAIAskMixin
- SelectAIConversationMixin
- SelectAIDataSourceCatalogMixin
- SelectAIDataSourceCsvMixin
- SelectAIDataSourceMetadataMixin
- SelectAIDataSourceMixin
- SelectAIDataSourcePreviewMixin
- SelectAIDataSourceSchemaMixin
- SelectAIGenerationMixin
- SelectAIScopedProfileMixin
- FastAPI
- dashboard_queries.py
- build_question_recommendations
- write_oci_cli_config_file

## God Nodes (most connected - your core abstractions)
1. `DatabaseManager` - 44 edges
2. `trace()` - 41 edges
3. `ConfigService` - 31 edges
4. `SettingsService` - 28 edges
5. `Settings` - 27 edges
6. `SelectAIBaseService` - 27 edges
7. `_question_has_any()` - 27 edges
8. `_sql_generation_hints()` - 27 edges
9. `SourceColumn` - 25 edges
10. `SourceTable` - 25 edges

## Surprising Connections (you probably didn't know these)
- `reinstall()` --calls--> `get_settings()`  [EXTRACTED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/core/config.py
- `_capture_runtime_config()` --references--> `DatabaseManager`  [EXTRACTED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/core/database.py
- `clean_schema()` --references--> `DatabaseManager`  [EXTRACTED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/core/database.py
- `_refresh_default_profile()` --references--> `DatabaseManager`  [EXTRACTED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/core/database.py
- `_runtime_config_with_fallbacks()` --references--> `DatabaseManager`  [EXTRACTED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/core/database.py

## Import Cycles
- None detected.

## Communities (157 total, 36 thin omitted)

### Community 0 - "analyticsChartUtils.ts"
Cohesion: 0.06
Nodes (58): AddVisualizationButton(), ChartControls(), ChartControlsProps, ChartScrollbarState, ChartScrollFrame(), ChartSortMode, measureScrollFrameScrollbar(), ChartPreview() (+50 more)

### Community 1 - "source_intents.py"
Cohesion: 0.22
Nodes (29): _is_atm_intent(), _is_authorization_audit_intent(), _is_authorization_preference_intent(), _is_average_balance_intent(), _is_average_intent(), _is_balance_intent(), _is_blocked_balance_intent(), _is_business_date_intent() (+21 more)

### Community 2 - "test_source_seed_script_helpers.py"
Cohesion: 0.11
Nodes (42): test_apply_metadata_collects_nonfatal_ddl_warnings(), test_replace_data_source_registers_columns_with_metadata(), test_runtime_connection_config_requires_complete_json(), test_runtime_db_config_path_prefers_environment_override(), test_runtime_db_config_path_reads_backend_env_file(), test_source_seed_data_schema_creates_upload_owner_without_login_grants(), test_source_seed_db_helpers_execute_expected_schema_statements(), test_source_seed_metadata_helpers_normalize_sql_values() (+34 more)

### Community 3 - "SelectAIDataSourceService"
Cohesion: 0.19
Nodes (9): SelectAIDataSourceService, RecordingConnection, RecordingCursor, RecordingDbManager, _source_column_inserts(), test_create_table_from_csv_accepts_and_records_column_metadata(), test_create_table_from_csv_uses_app_agent_connection_after_creating_schema(), test_register_existing_table_accepts_and_records_column_metadata() (+1 more)

### Community 4 - "SelectAISetupSections.tsx"
Cohesion: 0.11
Nodes (12): ApiKeySection(), ConfigSetter, FinishSetupButton(), GenAIModelOption, GenerativeAISection(), ObjectStorageSection(), SelectAISetupConfig, SetupResult (+4 more)

### Community 5 - "source_seed_synthetic.py"
Cohesion: 0.14
Nodes (33): parametrize, test_average_balance_hint_targets_history_dates(), test_operational_hints_cover_teller_and_term_deposit_questions(), test_synthetic_currency_columns_do_not_get_account_numbers(), test_synthetic_daily_log_includes_authorization_example(), test_synthetic_date_and_timestamp_columns_are_deterministic(), test_synthetic_examples_keep_full_2026_date_coverage(), test_synthetic_named_text_columns_use_domain_values() (+25 more)

### Community 6 - "oracleAgentGraphModel.ts"
Cohesion: 0.08
Nodes (42): appendUniqueTableRef(), baseInspection(), buildAnswerInspection(), buildExecuteInspection(), buildGraphBounds(), buildGraphEdges(), buildGraphNodes(), buildGraphViewBox() (+34 more)

### Community 7 - "SettingsService"
Cohesion: 0.06
Nodes (45): delete_agent_avatar(), get_agent_avatar(), get_public_settings_payload(), get_settings_payload(), get_settings_service(), BaseModel, delete, get (+37 more)

### Community 8 - "AuthService"
Cohesion: 0.12
Nodes (15): create_access_token(), Verify password against bcrypt hash., verify_password(), AuthService, User authentication service., fetch_user_info(), auth_service_with_config(), clear_auth_caches() (+7 more)

### Community 9 - "SetupStatusService"
Cohesion: 0.09
Nodes (19): Block runtime operations until the setup wizard has completed., require_setup_completed(), BootstrapStatusMixin, Lightweight setup-status reader used by runtime guards., SetupStatusService, clear_setup_status_cache(), DbManager, FakeConnection (+11 more)

### Community 10 - "UserService"
Cohesion: 0.12
Nodes (8): UserService, StubConnection, StubCursor, StubDbManager, test_ensure_admin_allows_initial_admin_group(), test_ensure_admin_rejects_missing_or_non_admin_users(), test_list_groups_maps_active_groups_and_closes_connection(), user_service_with_rows()

### Community 11 - "analytics.py"
Cohesion: 0.11
Nodes (22): _analytics_http_exception(), ask_analytics(), AskAnalyticsRequest, delete_analytics_conversation(), get_analytics_conversation(), get_question_recommendations(), list_analytics_conversations(), BaseModel (+14 more)

### Community 12 - "DataSourcePreviewModal.tsx"
Cohesion: 0.11
Nodes (25): LoadingState(), LoadingStateProps, SIZE_STYLES, DataSourcePreviewModal(), DataSourcePreviewModalProps, PreviewProps, response, source (+17 more)

### Community 13 - "Users.tsx"
Cohesion: 0.19
Nodes (18): emptyUserForm, Users(), UsersAuthUser, CreateUserModal(), DeleteUserModal(), highlightMatch(), UsersTable(), CreateUserForm (+10 more)

### Community 14 - "conversation_operations.py"
Cohesion: 0.18
Nodes (21): _assert_conversation_writable(), _json_dump(), _open_cursor(), Any, SelectAIConversationMixin, SelectAIConversationMutationMixin, _transaction_cursor(), _analytics_conversation_exists() (+13 more)

### Community 15 - "test_dashboard_support.py"
Cohesion: 0.13
Nodes (14): _alter_if_missing(), _create_if_missing(), DashboardSchemaMixin, _normalize_visibility(), parametrize, SchemaConnection, SchemaCursor, SchemaDbManager (+6 more)

### Community 16 - "dashboardDropPosition.ts"
Cohesion: 0.22
Nodes (21): buildDropPosition(), buildEdgeDropPosition(), buildRowGapPosition(), DashboardItemMoveUpdate, DropPositionInput, EMPTY_DROP_POSITION, findDashboardItemIndex(), findOpenRowElement() (+13 more)

### Community 17 - "trace"
Cohesion: 0.19
Nodes (34): check_setup_status(), complete_setup(), execute_setup(), get_setup_service(), _has_complete_database_config(), list_genai_models(), list_wallet_dsns(), get (+26 more)

### Community 18 - "AnalyticsChatPanel.tsx"
Cohesion: 0.10
Nodes (20): AddDashboardStep, AnalyticsAddVisualizationModal(), AnalyticsDashboardTray(), AnalyticsDeleteChatModal(), DashboardChartSpec, DashboardDraftItem, DashboardSummary, DashboardTargetMode (+12 more)

### Community 19 - "useDataSourcesController.ts"
Cohesion: 0.10
Nodes (23): DataSourceCatalogTableDetail, DEFAULT_DATA_SCHEMA, EMPTY_DATA_SOURCES, filterDataSources(), sortCatalogTables(), DataSourceListHelpers, DataSourceListState, DataSourceStats (+15 more)

### Community 20 - "variables.tf"
Cohesion: 0.07
Nodes (59): data.oci_core_images.oracle_linux, data.oci_database_autonomous_database.existing_adb, data.oci_identity_availability_domains.ads, local.adb_db_name, local.adb_display_name, local.autonomous_database_db_name, local.autonomous_database_id, local.autonomous_database_wallet_b64 (+51 more)

### Community 21 - "DataSourceObjectModal.tsx"
Cohesion: 0.11
Nodes (20): ConfirmDeleteModalProps, ConfirmModal(), ConfirmModalProps, ConfirmQuestionModal(), GlassModal(), GlassModalProps, ModalPortalProps, DataDictionaryEditor() (+12 more)

### Community 22 - "test_bootstrap_database_service.py"
Cohesion: 0.13
Nodes (14): is_app_schema_name(), BootstrapDatabaseMixin, missing_required_privileges(), DatabaseBootstrapper, DbManager, FakeOracleConnection, FakeOracleCursor, test_db_connection_accepts_app_agent_runtime_privileges() (+6 more)

### Community 23 - "test_bootstrap_oci_service.py"
Cohesion: 0.20
Nodes (14): CredentialBootstrapOciService, DbManager, FakeBootstrapOciService, FakeConnection, Path, Settings, test_complete_setup_marks_wizard_done_and_regenerates_runtime_config(), test_generative_ai_validation_normalizes_url_and_allows_http_status_errors() (+6 more)

### Community 24 - "Settings.tsx"
Cohesion: 0.22
Nodes (16): fieldValue(), normalizeSettingsPayload(), readTextFile(), Settings(), SettingsPayload, ShowToast, suggestedQuestionItems(), renderSettings() (+8 more)

### Community 25 - "ValueError"
Cohesion: 0.22
Nodes (20): DashboardItemMutationMixin, Any, _dashboard_item_insert_params(), _dashboard_item_update_fields(), _json_object_literal(), _normalize_dashboard_item_ids(), _normalize_dashboard_items(), _normalize_required_text() (+12 more)

### Community 26 - "Analytics.tsx"
Cohesion: 0.13
Nodes (22): Analytics(), applyDashboardCache(), getDashboardItemColumn(), getDashboardItemMoveUpdate(), getVisualizationWidth(), isDragBlockedTarget(), DashboardItemsGrid(), DragSession (+14 more)

### Community 27 - "useDataSourceObjectForm.ts"
Cohesion: 0.15
Nodes (17): buildCsvUploadDraft(), buildCsvUploadDrafts(), collectCsvUploadSlots(), CsvUploadSlot, CsvUploadSlotCollection, DataSourceColumnMetadata, DataSourceObjectFormHelpers, DataSourceObjectFormState (+9 more)

### Community 28 - "_set_if_present"
Cohesion: 0.21
Nodes (18): apply_doc_example_overrides(), _set_if_present(), _apply_balance_history_example(), apply_core_doc_example_overrides(), _apply_customer_account_examples(), _apply_customer_account_row(), _apply_customer_examples(), _apply_daily_log_examples() (+10 more)

### Community 29 - "usersApi.ts"
Cohesion: 0.13
Nodes (16): getApiErrorMessage(), Profile(), ProfileFormData, currentUser, usersApiMock, Profile, ChangePasswordPayload, CreateUserPayload (+8 more)

### Community 30 - "test_bootstrap_support.py"
Cohesion: 0.09
Nodes (28): build_oracle_connection_kwargs(), open_runtime_database_connection(), parse_bootstrap_sql_statements(), parse_tns_aliases(), Exception, read_private_key_for_db_credential(), resolve_runtime_database_config(), select_preferred_wallet_dsn() (+20 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, jsdom, tailwindcss, @testing-library/jest-dom, @types/react-dom, typescript, vite (+9 more)

### Community 32 - "AppRoutes.tsx"
Cohesion: 0.15
Nodes (17): App(), queryClient, Analytics, AnalyticsChatPanel, AppRoutes(), authenticatedRoutes(), DataSources, protectedPage() (+9 more)

### Community 33 - "DatabaseManager"
Cohesion: 0.09
Nodes (19): get_settings(), DatabaseManager, Initialize connection pool (thin mode, no Oracle Client)., Get connection from pool., Close pool (on shutdown)., Return whether a table exists in the current schema., Get singleton instance., Singleton to manage connection pool to Autonomous Database. (+11 more)

### Community 34 - "useAnalyticsConversationState.ts"
Cohesion: 0.11
Nodes (25): AnalyticsChatMessage, AnalyticsChatResult, AnalyticsAskRequest, AnalyticsAskResponse, AnalyticsConversationClient, AnalyticsConversationDetail, analyticsConversationQueryKey(), AnalyticsConversationSummary (+17 more)

### Community 35 - "AnalyticsDashboardModals.tsx"
Cohesion: 0.21
Nodes (8): ConfirmDeleteModal(), DashboardModalDashboard, DashboardModalItem, DeleteDashboardModal(), DeleteVisualizationModal(), RenameDashboardModal(), RenameVisualizationModal(), SqlModal()

### Community 36 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, axios, @dagrejs/dagre, lucide-react, react, react-dom, react-router-dom, @tanstack/react-query (+9 more)

### Community 37 - "_json_safe"
Cohesion: 0.26
Nodes (10): Any, SelectAIDataSourceCatalogMixin, _assert_catalog_table_selectable(), _select_catalog_columns(), _select_catalog_owners(), _select_catalog_table_comment(), _select_catalog_tables(), _select_data_sources() (+2 more)

### Community 38 - "validate_chart_spec"
Cohesion: 0.29
Nodes (9): ChartSpec, infer_chart_spec(), _is_number(), Any, validate_chart_spec(), Any, SelectAIAskMixin, test_infer_chart_spec_prefers_bar_for_category_and_number() (+1 more)

### Community 39 - "analyticsChatPanelUtils.ts"
Cohesion: 0.32
Nodes (10): AnalyticsChatPanel(), AnalyticsConversationForMessages, buildConversationMessages(), buildDashboardDraftItem(), findLatestAssistantMessage(), findLatestMessage(), findLatestUserQuestion(), GENAI_RESOURCE_EXHAUSTED_MESSAGE (+2 more)

### Community 40 - "AnalyticsChatPanelParts.tsx"
Cohesion: 0.14
Nodes (21): AnalyticsChatComposerProps, AnalyticsChatHeaderProps, AssistantChatListMessage, ChatListMessage, ChatMessageBubble(), formatTime(), AnalyticsDashboardHeader(), AnalyticsDashboardTabs() (+13 more)

### Community 41 - "DashboardService"
Cohesion: 0.13
Nodes (10): DashboardService, Any, make_service(), MutationConnection, MutationCursor, MutationDbManager, test_add_dashboard_items_inserts_normalized_visualization(), test_add_dashboard_items_rejects_empty_dashboard_id_or_items() (+2 more)

### Community 42 - "SetupWizard.tsx"
Cohesion: 0.13
Nodes (15): buildInstallErrorMessage(), InstallationData, InstallationResult, InstallationStep(), Props, SetupScriptError, SetupWizardData, SetupWizardProps (+7 more)

### Community 43 - "test_data_source_helpers.py"
Cohesion: 0.10
Nodes (15): SelectAIDataSourceMixin, CatalogConnection, CatalogCursor, CatalogService, MetadataCursor, RegisterConnection, RegisterCursor, RegisterService (+7 more)

### Community 44 - "useAnalyticsDashboardDraft.ts"
Cohesion: 0.09
Nodes (22): getAnalyticsErrorMessage(), isGenAiResourceExhaustedMessage(), AddDashboardItemsPayload, AddDashboardStep, ApiResponse, applyAddVisualizationTarget(), CreateDashboardPayload, DashboardChartSpec (+14 more)

### Community 45 - "AnalyticsChatContext.tsx"
Cohesion: 0.13
Nodes (14): analyticsApiMock, SearchChatsProbe(), analyticsResult, ConversationStateProbe(), dataSourcesClient(), addUnique(), AnalyticsChatContext, AnalyticsChatContextType (+6 more)

### Community 46 - "App.tsx"
Cohesion: 0.23
Nodes (15): AppRoutesComponent, fetchPublicBranding(), SessionScopedApp(), ShowToast, useAppBranding(), useSetupGate(), useSidebarChats(), sortConversations() (+7 more)

### Community 47 - "bootstrap_support.py"
Cohesion: 0.20
Nodes (12): BootstrapOciMixin, build_oci_client_config(), _failure_result(), _generative_model_options(), _inference_test_url(), missing_required_oci_config_keys(), _missing_saved_config_result(), normalize_oci_config_rows() (+4 more)

### Community 48 - "datetime"
Cohesion: 0.24
Nodes (13): test_convert_csv_value_rejects_bad_dates_and_numbers(), test_convert_csv_value_uses_oracle_column_type(), test_seed_value_module_keeps_loader_conversion_contract(), date, datetime, _apply_transaction_examples(), _apply_transaction_row(), convert_csv_value() (+5 more)

### Community 49 - "dataSourceUtils.ts"
Cohesion: 0.18
Nodes (20): DataSourceObjectModal(), catalogTablePlaceholder(), columnsToMetadata(), dataSourceStatusBadgeClassNames, getObjectSubmitState(), mergeMetadataWithColumns(), metadataBoolean(), metadataText() (+12 more)

### Community 50 - "SelectAIBaseService"
Cohesion: 0.07
Nodes (16): Any, SelectAIBaseService, _created_profile_attributes(), FakeLob, ScopedProfileConnection, ScopedProfileCursor, ScopedProfileService, test_create_scoped_profile_rejects_missing_genai_model() (+8 more)

### Community 51 - "dashboardDropPosition.test.ts"
Cohesion: 0.36
Nodes (6): DashboardLayoutItem, createDashboardElement(), createGrid(), elementFromPointMock, rect(), setRect()

### Community 52 - "analyticsApi.ts"
Cohesion: 0.10
Nodes (20): Home(), buildHomeStatCards(), formatNumber(), HomeStatCard, HomeStatsSource, StatKind, Home, AgentTraceItem (+12 more)

### Community 53 - "FakeCursor"
Cohesion: 0.18
Nodes (7): FakeConnection, FakeCursor, FakeDbManager, Exception, test_get_value_reads_config_in_one_connection(), test_get_value_returns_default_when_config_table_is_missing(), test_get_value_returns_default_when_connection_is_unavailable()

### Community 54 - "useDataSourceMutations.ts"
Cohesion: 0.12
Nodes (14): metadataWarningMessage(), cloneCsvUploadDrafts(), CsvUploadMutationVariables, CsvUploadStarter, DataSourceApiForMutations, DataSourceMutationListState, DataSourceMutations, DataSourceObjectFormForMutations (+6 more)

### Community 55 - "SearchChatsModal.tsx"
Cohesion: 0.30
Nodes (12): ConversationSummary, escapeRegExp(), highlightSearchMatch(), SearchChatsModal(), buildConversationMarkdown(), ConversationDetailForExport, ConversationMessageForExport, ConversationSummaryForSort (+4 more)

### Community 56 - "dataSourcesApi.ts"
Cohesion: 0.17
Nodes (11): DataSourceCatalogOwner, DataSourceCatalogTable, DataSourceCatalogTableDetail, DataSourceColumnMetadata, DataSourceMutationResponse, DataSourceRowsResponse, dataSourcesApi, DataSourceSchema (+3 more)

### Community 57 - "ToastContext.tsx"
Cohesion: 0.26
Nodes (7): ToastProbe(), ToastContext, ToastContextType, ToastItem, ToastProvider(), ToastViewport(), useToast()

### Community 58 - "LoginForm.tsx"
Cohesion: 0.27
Nodes (8): getLoginErrorMessage(), LoginForm(), makeMonochromeOracleSvg(), oracleServices, reviewSignals, AppBrand(), AppBrandProps, LoginForm

### Community 59 - "HTTPException"
Cohesion: 0.23
Nodes (20): ColumnMetadataRequest, create_schema(), CreateSchemaRequest, delete_data_source(), describe_catalog_table(), ExistingTableRequest, list_catalog_owners(), list_catalog_tables() (+12 more)

### Community 60 - "AppStatusService"
Cohesion: 0.22
Nodes (9): config_status(), health(), get, AppStatusService, FakeConfigService, FakeSettings, Path, test_config_status_reports_select_ai_and_storage_state() (+1 more)

### Community 61 - "SelectAIDataSourcePreviewMixin"
Cohesion: 0.13
Nodes (8): Any, SelectAIDataSourcePreviewMixin, FakeLob, PreviewConnection, PreviewCursor, PreviewService, test_json_safe_reads_lobs_and_serializes_runtime_values(), test_preview_data_source_rows_serializes_rows_and_clamps_pagination()

### Community 62 - "Sidebar.tsx"
Cohesion: 0.17
Nodes (12): ActionMenuItem, ChatScrollbarState, ChatStatusIndicator(), formatRelativeUpdatedAt(), measureChatScrollbar(), MenuItem, parseTimestamp(), RouteMenuItem (+4 more)

### Community 63 - "AuthContext.tsx"
Cohesion: 0.21
Nodes (10): AuthClient, AuthContext, AuthContextType, AuthProvider(), AuthQueryKeys, AuthUser, clearSessionCaches(), AuthProbe() (+2 more)

### Community 64 - "validate_read_only_select"
Cohesion: 0.31
Nodes (9): extract_sql_statement(), strip_sql_comments(), validate_read_only_select(), parametrize, test_validate_chart_spec_rejects_unknown_columns(), test_validate_read_only_select_accepts_single_fenced_select(), test_validate_read_only_select_accepts_single_select(), test_validate_read_only_select_rejects_select_ai_error_text() (+1 more)

### Community 65 - "bootstrap_script_service.py"
Cohesion: 0.36
Nodes (7): BootstrapScriptMixin, no_setup_scripts_result(), schema_guard_result(), is_ignorable_bootstrap_sql_error(), test_no_setup_scripts_result_includes_discovered_files_and_directory(), test_schema_guard_result_reports_connected_user(), test_is_ignorable_bootstrap_sql_error_matches_idempotent_oracle_errors()

### Community 66 - "execute_read_only_select"
Cohesion: 0.17
Nodes (7): execute_read_only_select(), Any, FakeConnection, FakeCursor, test_execute_read_only_select_rejects_mutating_sql_before_opening_connection(), test_execute_read_only_select_validates_and_serializes_rows(), ConnectionFactory

### Community 68 - "Settings"
Cohesion: 0.12
Nodes (7): Path, When `_env_file=None` is explicit, force defaults/init values only., Settings, test_settings_defaults_are_safe_without_env_file(), test_settings_resolves_runtime_paths_relative_to_backend_root(), BaseSettings, model_validator

### Community 70 - "routes/dashboards.py"
Cohesion: 0.20
Nodes (23): add_dashboard_items(), create_dashboard(), _current_user_id(), DashboardCreateRequest, DashboardItemRequest, DashboardItemsCreateRequest, DashboardItemUpdateRequest, DashboardReorderRequest (+15 more)

### Community 72 - "dashboard_mutations.py"
Cohesion: 0.33
Nodes (6): _archive_dashboard(), _insert_dashboard(), Any, _update_dashboard(), DashboardMutationMixin, Any

### Community 73 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, test:run

### Community 74 - "data_source_csv.py"
Cohesion: 0.14
Nodes (17): _assert_csv_table_selectable(), _complete_load_job(), _create_csv_table(), CsvUploadRows, _insert_csv_rows(), _insert_load_job(), _mark_load_job_failed(), Any (+9 more)

### Community 75 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 76 - "user_data.sh"
Cohesion: 0.70
Nodes (4): ensure_oci_icon(), retry(), user_data.sh script, use_reachable_base_images()

### Community 79 - ".terraform.lock.hcl"
Cohesion: 0.50
Nodes (3): provider.registry.terraform.io/hashicorp/null, provider.registry.terraform.io/hashicorp/tls, provider.registry.terraform.io/oracle/oci

### Community 80 - "dev_reinstall_oracle.py"
Cohesion: 0.16
Nodes (23): _capture_runtime_config(), clean_schema(), _drop_current_schema_objects(), _drop_data_schema(), _drop_retired_select_ai_artifacts(), _drop_select_ai_profiles(), _env_runtime_config(), _existing_profiles() (+15 more)

### Community 81 - "DataSources.tsx"
Cohesion: 0.18
Nodes (9): DataSourceDeleteConfirmModal(), DataSourceStats, documentToolbarButtonClassName, formatNumber(), DataSourceMetric(), DataSources(), metricToneClassNames, ShowToast (+1 more)

### Community 82 - "server_runner.py"
Cohesion: 0.36
Nodes (11): build_uvicorn_kwargs(), emit_startup_banner(), main(), parse_args(), Any, Path, Development runner for the backend server., resolve_reload_dirs() (+3 more)

### Community 83 - "_materialize_stored_result"
Cohesion: 0.33
Nodes (6): _materialize_stored_result(), _safe_max_rows(), _json_loads(), Any, test_materialize_stored_conversation_result_uses_snapshot_without_querying(), test_materialize_stored_conversation_result_validates_sql_and_chart_spec()

### Community 84 - "security.py"
Cohesion: 0.11
Nodes (20): get_auth_service(), get_current_user_info(), login(), LoginRequest, logout(), BaseModel, get, post (+12 more)

### Community 86 - "_safe_identifier"
Cohesion: 0.21
Nodes (12): Any, SelectAIDataSourceMetadataMixin, Any, _clean_optional_text(), _generated_schema_password(), Any, _qualified_name(), _safe_constraint_name() (+4 more)

### Community 90 - "RuntimeDBConfigStore"
Cohesion: 0.32
Nodes (3): Path, Persist DB connection chosen in setup wizard., RuntimeDBConfigStore

### Community 91 - "SelectAIServicesStep.tsx"
Cohesion: 0.20
Nodes (20): BooleanSetter, ResultSetter, runSetupTest(), saveSetupConfig(), SelectAIServicesStep(), SelectAIServicesStepProps, buildInferenceUrl(), buildUploadErrorMessage() (+12 more)

### Community 92 - "source_seed_sidecar.py"
Cohesion: 0.18
Nodes (20): _boolish(), normalize_identifier(), parse_metadata_payload(), _pick(), _picked_text(), Any, _text(), test_build_source_table_metadata_creates_json_sidecar_shape() (+12 more)

### Community 93 - "AnalyticsVisualizationCard.tsx"
Cohesion: 0.22
Nodes (12): AnalyticsVisualizationCard(), AnalyticsVisualizationCardProps, formatCellValue(), getInsertionLineClass(), getMetricLabel(), CardProps, item, VisualizationCardItem (+4 more)

### Community 95 - "scoped_profile_operations.py"
Cohesion: 0.12
Nodes (27): _is_balance_history_source(), _is_branch_dates_source(), _is_customer_account_source(), _is_daily_log_source(), _is_external_statement_source(), _is_external_transactions_source(), _is_hidden_statement_source(), _is_interest_processing_table() (+19 more)

### Community 97 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+14 more)

### Community 98 - "DatabaseConfigStep.tsx"
Cohesion: 0.15
Nodes (14): ConnectionAliasField(), ConnectionAliasFieldProps, DatabaseSetupNotice(), WalletUploadField(), WalletUploadFieldProps, WizardPasswordField(), WizardPasswordFieldProps, DatabaseConfigStep() (+6 more)

### Community 99 - "dev-cleanup.ps1"
Cohesion: 0.60
Nodes (5): Get-ListeningProcessIds(), Get-MatchingProcessIds(), Get-ProcessRecord(), Get-WorkspaceRoot(), Stop-DevProcesses()

### Community 100 - "main.py"
Cohesion: 0.25
Nodes (6): configure_logging(), Central logging configuration. Level can be set via LOG_LEVEL env (e.g. DEBUG,…, lifespan(), get, FastAPI entrypoint for Select AI Analytics., root()

### Community 101 - "_score_source_match"
Cohesion: 0.19
Nodes (13): _score_source_match(), FakeAnalyticsService, test_resolve_scoped_objects_uses_domain_terms_without_name_error(), test_resolve_scoped_objects_uses_preferred_domain_tables(), test_score_source_match_prefers_transactions_for_product_volume(), test_score_source_match_prioritizes_average_balance_history(), test_score_source_match_prioritizes_explicit_table_name(), test_score_source_match_prioritizes_specialized_operational_tables() (+5 more)

### Community 104 - "Bootstrap SQL"
Cohesion: 0.50
Nodes (3): Bootstrap SQL, Notes, Standard

### Community 105 - "test_conversation_operations.py"
Cohesion: 0.14
Nodes (10): ensure_conversation(), ConversationService, RecordingConnection, RecordingCursor, test_ensure_conversation_rejects_unknown_type(), test_normalize_conversation_id_sanitizes_and_limits_length(), test_question_usage_counts_only_successful_data_results(), test_record_question_run_commits_conversation_before_insert() (+2 more)

### Community 112 - "users.py"
Cohesion: 0.25
Nodes (17): change_password(), ChangePasswordRequest, create_user(), CreateUserRequest, current_user_id(), delete_user(), get_current_user_info(), get_user_service() (+9 more)

### Community 113 - "tracing.py"
Cohesion: 0.14
Nodes (21): checkpoint(), _duration_ms(), _ensure_trace_file(), _enter_trace(), _exception_trace(), _exit_trace(), get_trace_id(), Any (+13 more)

### Community 115 - "service.py"
Cohesion: 0.40
Nodes (5): SelectAIGenerationMixin, _is_velocity_window_intent(), _uses_current_clock(), _uses_current_clock_for_velocity_sql(), test_velocity_window_guard_detects_current_clock_sql()

### Community 116 - "source_seed_parser.py"
Cohesion: 0.30
Nodes (11): test_build_create_table_sql_targets_data_schema(), test_source_parser_skips_missing_objects_and_deduplicates(), test_write_seed_files_creates_csv_and_metadata_sidecar(), main(), build_create_table_sql(), _normalize_identifier(), oracle_type_for_ddl(), parse_source_tables() (+3 more)

### Community 117 - "Select AI Analytics"
Cohesion: 0.20
Nodes (9): CloudTechNext, Docker, License, Local Development, Runtime, Select AI Analytics, Test Data, Verification (+1 more)

### Community 119 - "Layout.tsx"
Cohesion: 0.32
Nodes (5): Footer(), Header(), HeaderProps, Layout(), LayoutProps

### Community 120 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include, vite.config.ts

### Community 121 - "Local Codex Policy for select-ai-analyzer"
Cohesion: 0.25
Nodes (7): Continuous Improvement Triggers, Future Delegation Hooks, Local Codex Policy for select-ai-analyzer, Local Validation Policy, Project Identity, Repo Operating Defaults, Repo-Specific Friction

### Community 123 - "ConfigService"
Cohesion: 0.23
Nodes (4): Settings, ConfigService, Any, Exception

### Community 125 - "Repository Agent Instructions"
Cohesion: 0.50
Nodes (3): Graphify, Repository Agent Instructions, Tool Usage

### Community 126 - "Improvement Log - select-ai-analyzer"
Cohesion: 0.50
Nodes (3): Entry Template, Improvement Log - select-ai-analyzer, Promotion Thresholds

### Community 363 - "FastAPI"
Cohesion: 0.35
Nodes (9): extract_zip_safely(), Path, safe_upload_name(), Path, test_extract_zip_safely_extracts_normal_wallet_members(), test_extract_zip_safely_rejects_paths_outside_destination(), test_settings_preserves_absolute_wallet_path(), test_setup_upload_name_strips_client_path_and_requires_suffix() (+1 more)

### Community 364 - "dashboard_queries.py"
Cohesion: 0.26
Nodes (11): DashboardQueryMixin, _json_loads(), _materialize_stored_result(), Any, _safe_max_rows(), _select_dashboard(), _select_dashboard_items(), _select_dashboards() (+3 more)

### Community 367 - "build_question_recommendations"
Cohesion: 0.49
Nodes (8): build_question_recommendations(), compact_questions(), normalize_question_text(), Any, _read_usage_value(), test_build_question_recommendations_prioritizes_unused_for_new_chat_and_usage_for_home(), test_compact_questions_removes_blank_and_duplicate_questions(), test_normalize_question_text_ignores_case_spacing_and_question_marks()

### Community 369 - "write_oci_cli_config_file"
Cohesion: 0.29
Nodes (7): Path, resolve_backend_root(), resolve_bootstrap_sql_dir(), resolve_oci_cli_config_path(), resolve_oci_key_file_path(), write_oci_cli_config_file(), test_write_oci_cli_config_file_uses_runtime_settings_path()

## Knowledge Gaps
- **308 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+303 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DatabaseManager` connect `DatabaseManager` to `main.py`, `SettingsService`, `AuthService`, `DashboardService`, `SetupStatusService`, `UserService`, `dev_reinstall_oracle.py`, `SelectAIBaseService`, `RuntimeDBConfigStore`, `ConfigService`, `AppStatusService`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `SelectAIBaseService` connect `SelectAIBaseService` to `DatabaseManager`, `SelectAIDataSourceService`, `test_data_source_helpers.py`, `analytics.py`, `service.py`, `_safe_identifier`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `trace()` connect `trace` to `bootstrap_script_service.py`, `AuthService`, `SetupStatusService`, `users.py`, `tracing.py`, `security.py`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `ValueError` (e.g. with `.load()` and `.save()`) actually correct?**
  _`ValueError` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Are the 46 inferred relationships involving `HTTPException` (e.g. with `get_current_user_info()` and `login()`) actually correct?**
  _`HTTPException` has 46 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `DatabaseManager` (e.g. with `SelectAIBaseService` and `DashboardService`) actually correct?**
  _`DatabaseManager` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `ConfigService` (e.g. with `AppStatusService` and `AuthService`) actually correct?**
  _`ConfigService` has 8 INFERRED edges - model-reasoned connections that need verification._