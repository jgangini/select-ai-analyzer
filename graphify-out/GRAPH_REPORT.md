# Graph Report - codex-select-ai  (2026-05-13)

## Corpus Check
- 257 files · ~112,611 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2290 nodes · 4142 edges · 117 communities (105 shown, 12 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 624 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6081113f`
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
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]

## God Nodes (most connected - your core abstractions)
1. `DashboardService` - 27 edges
2. `_question_has_any()` - 27 edges
3. `SelectAIDataSourceMixin` - 26 edges
4. `2026-03-18` - 26 edges
5. `_sql_generation_hints()` - 25 edges
6. `ConfigService` - 24 edges
7. `SettingsService` - 23 edges
8. `DatabaseManager` - 20 edges
9. `_score_domain_intents()` - 20 edges
10. `SelectAIBaseService` - 19 edges

## Surprising Connections (you probably didn't know these)
- `read_metadata_sidecar()` --calls--> `parse_metadata_payload()`  [INFERRED]
  scripts/source_seed_sidecar.py → apps/backend/app/select_ai/metadata_payload.py
- `reinstall()` --calls--> `SetupService`  [INFERRED]
  scripts/dev_reinstall_oracle.py → apps/backend/app/services/bootstrap_service.py
- `test_source_parser_skips_missing_objects_and_deduplicates()` --calls--> `parse_source_tables()`  [INFERRED]
  apps/backend/tests/test_source_parser.py → scripts/source_seed_parser.py
- `test_write_seed_files_creates_csv_and_metadata_sidecar()` --calls--> `write_seed_files()`  [INFERRED]
  apps/backend/tests/test_source_seed_loader.py → scripts/source_seed_synthetic.py
- `test_convert_csv_value_uses_oracle_column_type()` --calls--> `convert_csv_value()`  [INFERRED]
  apps/backend/tests/test_source_seed_script_helpers.py → scripts/source_seed_values.py

## Communities (117 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (73): _is_balance_history_source(), _is_branch_dates_source(), _is_customer_account_source(), _is_daily_log_source(), _is_external_statement_source(), _is_external_transactions_source(), _is_hidden_statement_source(), _is_interest_processing_table() (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (54): ColumnMetadataRequest, create_schema(), CreateSchemaRequest, delete_data_source(), describe_catalog_table(), ExistingTableRequest, list_catalog_owners(), list_catalog_tables() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (60): AddVisualizationButton(), ChartControls(), ChartControlsProps, ChartScrollbarState, ChartScrollFrame(), ChartSortMode, ChartPreview(), chartRendererTools (+52 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (63): RuntimeError, _capture_runtime_config(), clean_schema(), _drop_current_schema_objects(), _drop_data_schema(), _drop_retired_select_ai_artifacts(), _drop_select_ai_profiles(), _env_runtime_config() (+55 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (50): api, token, ConnectionAliasField(), ConnectionAliasFieldProps, DatabaseSetupNotice(), WalletUploadField(), WalletUploadFieldProps, WizardPasswordField() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): _assert_conversation_writable(), _json_dump(), _materialize_stored_result(), _open_cursor(), _safe_max_rows(), SelectAIConversationMixin, SelectAIConversationMutationMixin, _transaction_cursor() (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (48): appendUniqueTableRef(), baseInspection(), buildAnswerInspection(), buildExecuteInspection(), buildGraphBounds(), buildGraphEdges(), buildGraphNodes(), buildGraphViewBox() (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (50): main(), build_create_table_sql(), _normalize_identifier(), oracle_type_for_ddl(), parse_source_tables(), Parse SQL*Plus DESC output from .source into table metadata.      Blocks with SQ, SourceColumn, SourceTable (+42 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (31): Protocol, AvatarFile, AvatarStorage, AvatarValidationError, media_type(), _coerce_suggested_questions(), _compact_suggested_questions(), _default_payload() (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (27): BaseSettings, get_settings(), When `_env_file=None` is explicit, force defaults/init values only., Settings, create_access_token(), decode_access_token(), get_current_user(), get_settings() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (18): _cursor(), SelectAIBaseService, SelectAIBaseService, SelectAIScopedProfileMixin, _created_profile_attributes(), FakeLob, ScopedProfileConnection, ScopedProfileCursor (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (38): DashboardItemMutationMixin, _dashboard_item_insert_params(), _dashboard_item_update_fields(), _json_object_literal(), _normalize_dashboard_item_ids(), _normalize_dashboard_items(), _normalize_required_text(), _dashboard_exists_for_owner() (+30 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (37): Home(), buildHomeStatCards(), formatNumber(), HomeStatCard, HomeStatsSource, StatKind, cards, AgentTraceItem (+29 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (21): change_password(), ChangePasswordRequest, create_user(), CreateUserRequest, current_user_id(), delete_user(), get_current_user_info(), get_user_service() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (28): Profile(), ProfileFormData, currentUser, usersApiMock, emptyUserForm, UsersAuthUser, ChangePasswordPayload, CreateUserPayload (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (24): LoadingState(), LoadingStateProps, SIZE_STYLES, DataSourcePreviewModal(), DataSourcePreviewModalProps, DataSourcesTable(), DataSourcesTableProps, Pagination() (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (25): extract_zip_safely(), safe_upload_name(), check_setup_status(), complete_setup(), execute_setup(), get_setup_service(), _has_complete_database_config(), list_genai_models() (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (29): DataSourceCatalogTableDetail, EMPTY_DATA_SOURCES, filterDataSources(), mergeMetadataWithColumns(), parseCsvHeaderLine(), parseCsvHeaders(), schemaNeedsCreation(), sortCatalogTables() (+21 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (23): ConfirmDeleteModal(), ConfirmDeleteModalProps, ConfirmModal(), ConfirmModalProps, ConfirmQuestionModal(), GlassModal(), GlassModalProps, ModalPortalProps (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (23): AnalyticsAskRequest, AnalyticsAskResponse, AnalyticsConversationClient, AnalyticsConversationDetail, analyticsConversationQueryKey(), AnalyticsConversationSummary, ApiResponse, AskQuestionVariables (+15 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (27): 2026-03-18, Avatar del agente en chat (fallback por letra), Batería de 21 preguntas RAG (script de evaluación), Batería RAG: carpetas RM797, progreso y ETA, Batería RAG: corrida completa 2026-03-20 (2 carpetas, 42 preguntas), Batería RAG: modo secuencial por carpeta (`--workers 1`), Cambio de conexión Oracle: `HIGH` -> `MEDIUM`, DELETE /api/files/{id} -> 500 (FK monitorings) (+19 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (14): BootstrapStatusMixin, Lightweight setup-status reader used by runtime guards., SetupStatusService, DbManager, FakeConnection, FakeStatusReader, PooledDbManager, ReadableValue (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (22): AddDashboardItemsPayload, AddDashboardStep, ApiResponse, CreateDashboardPayload, DashboardChartSpec, DashboardDetail, DashboardDraftItem, DashboardDraftTargetState (+14 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (14): BootstrapOciMixin, CredentialBootstrapOciService, DbManager, FakeBootstrapOciService, FakeConnection, Settings, test_complete_setup_marks_wizard_done_and_regenerates_runtime_config(), test_generative_ai_validation_normalizes_url_and_allows_http_status_errors() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (18): compactQuestions(), normalizeSuggestedQuestions(), parseCsvRows(), parseSuggestedQuestionsCsv(), replaceSuggestedQuestionAt(), selectInitialSuggestedQuestions(), STARTER_SUGGESTED_QUESTIONS, pool (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (21): normalizeIdentifier(), buildCsvUploadDraft(), buildCsvUploadDrafts(), collectCsvUploadSlots(), CsvUploadSlot, CsvUploadSlotCollection, DataSourceColumnMetadata, DataSourceObjectFormHelpers (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (12): _alter_if_missing(), _create_if_missing(), DashboardSchemaMixin, FakeLob, SchemaCursor, SchemaDbManager, test_alter_if_missing_ignores_existing_column_or_constraint_errors(), test_create_if_missing_ignores_existing_object_error() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (20): apply_doc_example_overrides(), _set_if_present(), _apply_balance_history_example(), apply_core_doc_example_overrides(), _apply_customer_account_examples(), _apply_customer_account_row(), _apply_customer_examples(), _apply_daily_log_examples() (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (21): Analytics, AnalyticsChatPanel, AppRoutes(), authenticatedRoutes(), DataSources, Home, LoginForm, Profile (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (19): build_oracle_connection_kwargs(), open_runtime_database_connection(), read_private_key_for_db_credential(), resolve_oci_cli_config_path(), resolve_runtime_database_config(), summarize_oracle_connect_error(), write_oci_cli_config_file(), DbManager (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (9): DatabaseManager, _missing_required_config(), Initialize connection pool (thin mode, no Oracle Client)., Get connection from pool., Close pool (on shutdown)., Return whether a table exists in the current schema., Persist DB connection chosen in setup wizard., Singleton to manage connection pool to Autonomous Database. (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (19): AnalyticsChatComposerProps, AnalyticsChatHeaderProps, AssistantChatListMessage, ChatListMessage, ChatMessageBubble(), formatTime(), DashboardHeaderBase, DashboardTabSummary (+11 more)

### Community 32 - "Community 32"
Cohesion: 0.1
Nodes (20): AddDashboardStep, AnalyticsAddVisualizationModal(), AnalyticsDashboardTray(), AnalyticsDeleteChatModal(), DashboardChartSpec, DashboardDraftItem, DashboardSummary, DashboardTargetMode (+12 more)

### Community 33 - "Community 33"
Cohesion: 0.1
Nodes (20): AnalyticsChatPanel(), ShowToast, AnalyticsChatComposer(), AnalyticsChatHeader(), AnalyticsChatMessageList(), AnalyticsSuggestedQuestionButtons(), composer, onChange (+12 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (20): BaseHTTPMiddleware, checkpoint(), _duration_ms(), _ensure_trace_file(), _enter_trace(), _exception_trace(), _exit_trace(), get_trace_id() (+12 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (20): DashboardLayoutItem, getDashboardItemColumn(), getDashboardItemMoveUpdate(), getVisualizationWidth(), isDragBlockedTarget(), container, createDashboardElement(), createGrid() (+12 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (8): make_service(), MutationConnection, MutationCursor, MutationDbManager, test_add_dashboard_items_inserts_normalized_visualization(), test_add_dashboard_items_rejects_empty_dashboard_id_or_items(), test_reorder_dashboard_items_rejects_duplicate_items_before_opening_connection(), test_update_dashboard_item_rejects_invalid_layout_before_opening_connection()

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (14): Footer(), buildInstallErrorMessage(), InstallationData, InstallationResult, InstallationStep(), Props, SetupScriptError, renderStep() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (18): buildDropPosition(), buildEdgeDropPosition(), buildRowGapPosition(), DropPositionInput, EMPTY_DROP_POSITION, findDashboardItemIndex(), findOpenRowElement(), getDashboardItemElements() (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (16): DashboardItemMoveUpdate, DragSession, ShowToast, AddDashboardItemsPayload, ChartSpec, CreateDashboardPayload, DashboardDetail, DashboardItem (+8 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (15): checkSetupComplete(), readAppSetting(), resolveAgentName(), resolveApplicationName(), resolveSuggestedQuestions(), settingsApi, settingsQueryKeys, setupQueryKeys (+7 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (18): AnalyticsChatMessage, AnalyticsChatResult, AnalyticsConversationForMessages, buildConversationMessages(), buildDashboardDraftItem(), findLatestAssistantMessage(), findLatestMessage(), findLatestUserQuestion() (+10 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (17): AnalyticsVisualizationCard(), AnalyticsVisualizationCardProps, formatCellValue(), getInsertionLineClass(), getMetricLabel(), CardProps, item, onCardMouseDown (+9 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (12): analyticsApiMock, conversation, deleteOverlay, SearchChatsProbe(), searchOverlay, AnalyticsChatContext, AnalyticsChatContextType, AnalyticsChatProvider() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (12): build_oci_client_config(), _failure_result(), _generative_model_options(), _inference_test_url(), missing_required_oci_config_keys(), _missing_saved_config_result(), _probe_inference_endpoint(), _read_key_file_content() (+4 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (16): onClose, onPageChange, PreviewProps, { rerender }, response, source, csvSource, onDelete (+8 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (8): DatabaseBootstrapper, FakeOracleConnection, FakeOracleCursor, test_db_connection_accepts_app_agent_runtime_privileges(), test_db_connection_rejects_missing_default_data_schema_without_create_user(), test_list_wallet_dsns_reports_missing_tnsnames(), test_list_wallet_dsns_returns_aliases_and_prefers_medium(), test_save_runtime_db_config_delegates_to_db_manager()

### Community 47 - "Community 47"
Cohesion: 0.18
Nodes (8): BootstrapOciMixin, _oci_file_values(), _upsert_config_items(), normalize_oci_config_rows(), normalize_oci_config_value(), ReadableValue, test_normalize_oci_config_rows_strips_prefix_and_reads_values(), test_normalize_oci_config_value_reads_lobs_and_trims()

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (6): FakeConnection, FakeCursor, FakeDbManager, test_get_value_reads_config_in_one_connection(), test_get_value_returns_default_when_config_table_is_missing(), test_get_value_returns_default_when_connection_is_unavailable()

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (13): ToastProbe(), ToastContext, ToastContextType, ToastItem, ToastProvider(), ToastViewport(), useToast(), SelectAIServicesStep() (+5 more)

### Community 50 - "Community 50"
Cohesion: 0.21
Nodes (14): ConversationSummary, escapeRegExp(), highlightSearchMatch(), SearchChatsModal(), buildConversationMarkdown(), ConversationDetailForExport, ConversationMessageForExport, ConversationSummaryForSort (+6 more)

### Community 51 - "Community 51"
Cohesion: 0.2
Nodes (14): AdminPasswordRequest, DBRuntimeConfigRequest, DBTestRequest, GenerativeAIConfigRequest, ObjectStorageTestRequest, OCIConfigRequest, SetupRequest, WalletDSNRequest (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.21
Nodes (7): config_status(), health(), AppStatusService, FakeConfigService, FakeSettings, test_config_status_reports_select_ai_and_storage_state(), test_health_status_uses_runtime_model_default()

### Community 53 - "Community 53"
Cohesion: 0.16
Nodes (11): AuthClient, AuthContext, AuthContextType, AuthProvider(), AuthQueryKeys, AuthUser, authClient, AuthProbe() (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.16
Nodes (10): ActionMenuItem, ChatScrollbarState, ChatStatusIndicator(), formatRelativeUpdatedAt(), MenuItem, parseTimestamp(), RouteMenuItem, Sidebar() (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.13
Nodes (14): CloudTechNext, code:bash (docker run -d \), code:powershell (py -3 scripts\generate_source_seed.py --default-rows 365 --f), code:powershell (.\scripts\dev.ps1), code:powershell (.\scripts\dev.ps1 -InstallFrontendDeps), code:powershell (.\scripts\check-project.ps1 -InstallDeps), code:powershell (.\scripts\check-project.ps1), Docker (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (5): CatalogConnection, CatalogCursor, CatalogService, test_list_data_sources_returns_json_safe_catalog_rows(), test_list_schemas_includes_default_schema_and_source_counts()

### Community 57 - "Community 57"
Cohesion: 0.18
Nodes (5): execute_read_only_select(), FakeConnection, FakeCursor, test_execute_read_only_select_rejects_mutating_sql_before_opening_connection(), test_execute_read_only_select_validates_and_serializes_rows()

### Community 58 - "Community 58"
Cohesion: 0.24
Nodes (4): ConfigService, _is_missing_config_table_error(), _normalize_value(), Persist runtime configuration in the `config` table.

### Community 59 - "Community 59"
Cohesion: 0.24
Nodes (11): validate_chart_spec(), extract_sql_statement(), strip_sql_comments(), validate_read_only_select(), test_infer_chart_spec_prefers_bar_for_category_and_number(), test_infer_chart_spec_uses_bar_for_single_row_numeric_comparison(), test_validate_chart_spec_rejects_unknown_columns(), test_validate_read_only_select_accepts_single_fenced_select() (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.19
Nodes (11): BootstrapScriptMixin, execute_setup_scripts(), no_setup_scripts_result(), schema_guard_result(), is_ignorable_bootstrap_sql_error(), parse_bootstrap_sql_statements(), test_no_setup_scripts_result_includes_discovered_files_and_directory(), test_schema_guard_result_reports_connected_user() (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.19
Nodes (9): DashboardModalDashboard, DashboardModalItem, DeleteDashboardModal(), DeleteVisualizationModal(), RenameDashboardModal(), RenameVisualizationModal(), SqlModal(), onClose (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (7): analytics, analyticsResult, ConversationStateProbe(), dataSources, dataSourcesClient(), pendingAsk, { result }

### Community 63 - "Community 63"
Cohesion: 0.44
Nodes (11): add_dashboard_items(), create_dashboard(), _current_user_id(), delete_dashboard(), delete_dashboard_item(), get_dashboard(), list_dashboards(), reorder_dashboard_items() (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.21
Nodes (5): SelectAIDataSourceMixin, MetadataCursor, RegisterService, test_apply_select_ai_metadata_adds_comments_annotations_and_primary_key(), test_apply_select_ai_metadata_collects_statement_warnings()

### Community 65 - "Community 65"
Cohesion: 0.26
Nodes (8): _select_catalog_tables(), _data_source_from_cursor(), SelectAIDataSourcePreviewMixin, _source_column_details(), _json_loads(), _json_safe(), _read_lob(), _rows_as_dicts()

### Community 66 - "Community 66"
Cohesion: 0.18
Nodes (9): DataSourceListHelpers, DataSourceListState, DataSourceStats, DataSourceSummary, listHelpers, { rerender, result }, { result }, Source (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (10): delete_agent_avatar(), get_agent_avatar(), get_public_settings_payload(), get_settings_payload(), get_settings_service(), reset_settings(), settings_status(), SettingsUpdateRequest (+2 more)

### Community 68 - "Community 68"
Cohesion: 0.2
Nodes (7): SelectAIDataSourceMixin, SelectAIDataSourceCatalogMixin, SelectAIDataSourceCsvMixin, SelectAIDataSourceMetadataMixin, SelectAIDataSourcePreviewMixin, SelectAIDataSourceSchemaMixin, PreviewService

### Community 69 - "Community 69"
Cohesion: 0.25
Nodes (6): SelectAIDataSourceCatalogMixin, _assert_catalog_table_selectable(), _select_catalog_columns(), _select_catalog_owners(), _select_catalog_table_comment(), _select_data_sources()

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (5): PreviewConnection, RegisterCursor, test_preview_data_source_rows_serializes_rows_and_clamps_pagination(), test_register_existing_table_rolls_back_when_source_column_sync_fails(), test_sql_name_helpers_reject_blank_identifier()

### Community 71 - "Community 71"
Cohesion: 0.2
Nodes (3): CapacityExhaustedDuringSqlAskService, test_ask_propagates_capacity_error_during_narration_without_fallback_answer(), test_ask_propagates_capacity_error_during_sql_generation_without_fallback()

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (5): is_genai_resource_exhausted(), Raised when the configured model provider reports temporary capacity exhaustion., SelectAIModelCapacityError, SelectAIGenerationMixin, test_genai_resource_exhausted_detection_sanitizes_oracle_stack()

### Community 73 - "Community 73"
Cohesion: 0.2
Nodes (6): DataSourceDeleteConfirmModal(), DataSourceStats, DataSources(), metricToneClassNames, ShowToast, dataSourcesControllerMock

### Community 74 - "Community 74"
Cohesion: 0.2
Nodes (9): metadataWarningMessage(), DataSourceApiForMutations, DataSourceColumnMetadata, DataSourceMutationListState, DataSourceMutations, DataSourceObjectFormForMutations, DataSourceSummary, showMetadataWarnings() (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.4
Nodes (9): build_uvicorn_kwargs(), emit_startup_banner(), main(), parse_args(), Development runner for the backend server., resolve_reload_dirs(), resolve_reload_excludes(), resolve_repo_root() (+1 more)

### Community 76 - "Community 76"
Cohesion: 0.2
Nodes (6): DashboardItemMutationMixin, DashboardMutationMixin, DashboardQueryMixin, DashboardSchemaMixin, DashboardReorderRequest, DashboardService

### Community 77 - "Community 77"
Cohesion: 0.2
Nodes (3): FakeLob, PreviewCursor, test_json_safe_reads_lobs_and_serializes_runtime_values()

### Community 78 - "Community 78"
Cohesion: 0.31
Nodes (4): id, BootstrapStatusMixin, check_setup_status(), clear_status_cache()

### Community 79 - "Community 79"
Cohesion: 0.22
Nodes (7): BootstrapDatabaseMixin, BootstrapScriptMixin, get_password_hash(), Generate bcrypt hash of password (72-byte limit)., create_admin_user(), Initial setup service (database, OCI, admin user)., SetupService

### Community 80 - "Community 80"
Cohesion: 0.39
Nodes (8): _analytics_http_exception(), ask_analytics(), delete_analytics_conversation(), get_analytics_conversation(), get_question_recommendations(), list_analytics_conversations(), rename_analytics_conversation(), RenameAnalyticsConversationRequest

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (4): ChartSpec, infer_chart_spec(), _is_number(), SelectAIAskMixin

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (4): BootstrapDatabaseMixin, missing_required_privileges(), DbManager, test_missing_required_privileges_reports_data_upload_gaps()

### Community 83 - "Community 83"
Cohesion: 0.28
Nodes (6): AppBrand(), AppBrandProps, Header(), HeaderProps, Layout(), LayoutProps

### Community 85 - "Community 85"
Cohesion: 0.25
Nodes (5): Block runtime operations until the setup wizard has completed., require_setup_completed(), get_db_manager(), Helpers de sesion/conexion para FastAPI., Retorna singleton de DatabaseManager.

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (3): AnalyticsDashboardSurface(), { rerender }, SurfaceProps

### Community 87 - "Community 87"
Cohesion: 0.36
Nodes (6): getLoginErrorMessage(), LoginForm(), makeMonochromeOracleSvg(), oracleServices, reviewSignals, login

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (5): get_oci_bucket_name(), get_oci_namespace(), Read OCI-related configuration from config table., Get OCI namespace from config table., Get single Object Storage bucket name from config table.

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (6): AnalyticsDashboardHeader(), AnalyticsDashboardTabs(), onDelete, onRename, onSelect, onVisibilityChange

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (5): AskAnalyticsRequest, SelectAIAnalyticsService, SelectAIAskMixin, SelectAIConversationMixin, SelectAIGenerationMixin

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (3): api, { result }, sources

### Community 95 - "Community 95"
Cohesion: 0.6
Nodes (5): Get-ListeningProcessIds(), Get-MatchingProcessIds(), Get-ProcessRecord(), Get-WorkspaceRoot(), Stop-DevProcesses()

### Community 98 - "Community 98"
Cohesion: 0.4
Nodes (4): parse_tns_aliases(), select_preferred_wallet_dsn(), test_parse_tns_aliases_returns_unique_aliases_in_file_order(), test_select_preferred_wallet_dsn_prefers_medium_alias()

### Community 99 - "Community 99"
Cohesion: 0.5
Nodes (3): DataDictionaryEditor(), DataSourceColumnMetadata, onColumnChange

### Community 100 - "Community 100"
Cohesion: 0.5
Nodes (3): Graphify, Repository Agent Instructions, Tool Usage

### Community 101 - "Community 101"
Cohesion: 0.5
Nodes (3): Bootstrap SQL, Notes, Standard

## Knowledge Gaps
- **452 isolated node(s):** `Top-level package marker for Docker runtime imports.`, `FastAPI entrypoint for Select AI Analytics.`, `Block runtime operations until the setup wizard has completed.`, `When `_env_file=None` is explicit, force defaults/init values only.`, `Persist DB connection chosen in setup wizard.` (+447 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `id` connect `Community 78` to `Community 9`, `Community 19`?**
  _High betweenness centrality (0.432) - this node is a cross-community bridge._
- **Why does `DatabaseManager` connect `Community 30` to `Community 8`, `Community 9`, `Community 10`, `Community 76`, `Community 13`, `Community 78`, `Community 52`, `Community 21`, `Community 58`?**
  _High betweenness centrality (0.331) - this node is a cross-community bridge._
- **Why does `BootstrapStatusMixin` connect `Community 78` to `Community 92`, `Community 21`, `Community 30`, `Community 79`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `ValueError` (e.g. with `.load()` and `.save()`) actually correct?**
  _`ValueError` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `DashboardService` (e.g. with `DashboardItemRequest` and `DashboardCreateRequest`) actually correct?**
  _`DashboardService` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `SelectAIDataSourceMixin` (e.g. with `SelectAIBaseService` and `SelectAIDataSourceCatalogMixin`) actually correct?**
  _`SelectAIDataSourceMixin` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Top-level package marker for Docker runtime imports.`, `FastAPI entrypoint for Select AI Analytics.`, `Block runtime operations until the setup wizard has completed.` to the rest of the system?**
  _452 weakly-connected nodes found - possible documentation gaps or missing edges._