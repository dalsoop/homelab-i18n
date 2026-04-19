import type { Dispatch, RefObject, SetStateAction } from "react";

import { humanizeMemberRole } from "../../lib/humanize";
import type { Project, ProjectSettings } from "../../types";

import type { ProjectForm, ProjectMembershipItem, SettingsForm } from "./models";
import { SETTINGS_COPY } from "./settingsCopy";

type SettingsCoreSectionsProps = {
  projectForm: ProjectForm;
  setProjectForm: Dispatch<SetStateAction<ProjectForm>>;
  settingsForm: SettingsForm;
  setSettingsForm: Dispatch<SetStateAction<SettingsForm>>;
  dirty: boolean;
  saving: boolean;
  autoUpdateMasterRef: RefObject<HTMLInputElement | null>;
  autoUpdateAllEnabled: boolean;
  onSetAllAutoUpdates: (enabled: boolean) => void;
  onGoToCharacters: () => void;
  onSave: () => void;
  baselineProject: Project;
  baselineSettings: ProjectSettings;
  canManageMemberships: boolean;
  currentUserId: string;
  membershipsLoading: boolean;
  membershipSaving: boolean;
  memberships: ProjectMembershipItem[];
  inviteUserId: string;
  onChangeInviteUserId: (value: string) => void;
  inviteRole: "viewer" | "editor";
  onChangeInviteRole: (role: "viewer" | "editor") => void;
  onInviteMember: () => void;
  onLoadMemberships: () => void;
  onUpdateMemberRole: (targetUserId: string, role: "viewer" | "editor") => void;
  onRemoveMember: (targetUserId: string) => void;
};

export function SettingsCoreSections(props: SettingsCoreSectionsProps) {
  const {
    projectForm,
    setProjectForm,
    settingsForm,
    setSettingsForm,
    dirty,
    saving,
    autoUpdateMasterRef,
    autoUpdateAllEnabled,
    onSetAllAutoUpdates,
    onGoToCharacters,
    onSave,
    baselineProject,
    baselineSettings,
    canManageMemberships,
    currentUserId,
    membershipsLoading,
    membershipSaving,
    memberships,
    inviteUserId,
    onChangeInviteUserId,
    inviteRole,
    onChangeInviteRole,
    onInviteMember,
    onLoadMemberships,
    onUpdateMemberRole,
    onRemoveMember,
  } = props;
  return (
    <>
      <section className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="font-content text-xl">프로젝트 정보.</div>
            <div className="text-xs text-subtext">이름. / 주제, 소재, 주제 소재. / 한 줄 요약.logline）</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="btn btn-secondary" disabled={saving} onClick={onGoToCharacters} type="button">
              {dirty ? "저장 후 다음 단계: 캐릭터 카드." : "다음 단계: 캐릭터 카드."}
            </button>
            <button className="btn btn-primary" disabled={!dirty || saving} onClick={onSave} type="button">
              저장.
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-subtext">프로젝트명.</span>
            <input
              className="input"
              name="project_name"
              value={projectForm.name}
              onChange={(e) => setProjectForm((value) => ({ ...value, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-subtext">주제, 소재, 주제 소재.</span>
            <input
              className="input"
              name="project_genre"
              value={projectForm.genre}
              onChange={(e) => setProjectForm((value) => ({ ...value, genre: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 sm:col-span-3">
            <span className="text-xs text-subtext">한 줄 요약.logline）</span>
            <textarea
              className="textarea"
              name="project_logline"
              rows={2}
              value={projectForm.logline}
              onChange={(e) => setProjectForm((value) => ({ ...value, logline: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="panel p-6">
        <div className="grid gap-1">
          <div className="font-content text-xl">작품 설정 (필수 기재)</div>
          <div className="text-xs text-subtext">작문./개요 작성 시에는 이 내용을 참고하고, 최대한 구체적으로 작성하는 것이 좋습니다.。</div>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-subtext">세계관.</span>
            <textarea
              className="textarea atelier-content"
              name="world_setting"
              rows={6}
              value={settingsForm.world_setting}
              onChange={(e) => setSettingsForm((value) => ({ ...value, world_setting: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">스타일.</span>
            <textarea
              className="textarea atelier-content"
              name="style_guide"
              rows={6}
              value={settingsForm.style_guide}
              onChange={(e) => setSettingsForm((value) => ({ ...value, style_guide: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-subtext">제한.</span>
            <textarea
              className="textarea atelier-content"
              name="constraints"
              rows={6}
              value={settingsForm.constraints}
              onChange={(e) => setSettingsForm((value) => ({ ...value, constraints: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="panel p-6">
        <div className="grid gap-1">
          <div className="font-content text-xl">자동 업데이트(권장)</div>
          <div className="text-xs text-subtext">장(章)의 최종 원고 확정.done）자동으로 백그라운드 업데이트 작업을 실행하므로 일반 사용자는 이 기능을 활성화해 두는 것이 좋습니다.。</div>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              ref={autoUpdateMasterRef}
              className="checkbox"
              checked={autoUpdateAllEnabled}
              onChange={(e) => onSetAllAutoUpdates(e.target.checked)}
              type="checkbox"
            />
            원클릭으로 켜고 끌 수 있습니다: 자동 업데이트 (챕터가 최종 확정되면 실행).
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_worldbook_enabled}
              onChange={(e) =>
                setSettingsForm((value) => ({ ...value, auto_update_worldbook_enabled: e.target.checked }))
              }
              type="checkbox"
            />
            세계 책: 항목 자동 업데이트(worldbook_auto_update）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_characters_enabled}
              onChange={(e) =>
                setSettingsForm((value) => ({ ...value, auto_update_characters_enabled: e.target.checked }))
              }
              type="checkbox"
            />
            캐릭터 정보: 자동 업데이트.characters_auto_update）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_story_memory_enabled}
              onChange={(e) =>
                setSettingsForm((value) => ({ ...value, auto_update_story_memory_enabled: e.target.checked }))
              }
              type="checkbox"
            />
            플롯 기억: 자동으로 분석하고 기록합니다.plot_auto_update）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_graph_enabled}
              onChange={(e) => setSettingsForm((value) => ({ ...value, auto_update_graph_enabled: e.target.checked }))}
              type="checkbox"
            />
            다이어그램: 자동 업데이트 ( )graph_auto_update）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_vector_enabled}
              onChange={(e) => setSettingsForm((value) => ({ ...value, auto_update_vector_enabled: e.target.checked }))}
              type="checkbox"
            />
            벡터 인덱스: 자동 재구축(벡터 인덱스: 자동 재구성)vector_rebuild）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_search_enabled}
              onChange={(e) => setSettingsForm((value) => ({ ...value, auto_update_search_enabled: e.target.checked }))}
              type="checkbox"
            />
            검색 인덱스: 자동 재구축 중(입니다).search_rebuild）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_fractal_enabled}
              onChange={(e) =>
                setSettingsForm((value) => ({ ...value, auto_update_fractal_enabled: e.target.checked }))
              }
              type="checkbox"
            />
            분할 기억: 자동 재구성.fractal_rebuild）
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              className="checkbox"
              checked={settingsForm.auto_update_tables_enabled}
              onChange={(e) => setSettingsForm((value) => ({ ...value, auto_update_tables_enabled: e.target.checked }))}
              type="checkbox"
            />
            수치 표: 자동 업데이트.table_ai_update）
          </label>
        </div>

        <div className="mt-2 text-xs text-subtext">
          알림: 기능을 끄면 ‘챕터 최종본’이 생성될 때 자동으로 대기열에 추가되지 않습니다. 하지만 해당 페이지에서 여전히 기능을 이용할 수 있습니다./작업 센터에서 직접 실행.。
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn btn-secondary btn-sm"
            disabled={saving}
            onClick={() => onSetAllAutoUpdates(true)}
            type="button"
          >
            전부 켜기 (권장)
          </button>
        </div>
      </section>

      <details className="panel" aria-label="문맥 최적화 (문맥 최적화기)">
        <summary className="ui-focus-ring ui-transition-fast cursor-pointer select-none p-6">
          <div className="grid gap-1">
            <div className="font-content text-xl text-ink">문맥 최적화.Context Optimizer）</div>
            <div className="text-xs text-subtext">
              맞다. / 옳다. / 그렇다. / 응. / (어떤 것에) 대하여. / (어떤 것에) 대하여. StructuredMemory / WORLD_BOOK 중복 제거, 정렬, 표 형식으로 변환하여 데이터를 통합하고, 이를 통해 효율성을 높입니다. tokens 가독성을 높이기 위해 (기본적으로는 비활성화되어 있음).。
            </div>
            <div className="text-xs text-subtext">
              {SETTINGS_COPY.contextOptimizer.status(baselineSettings.context_optimizer_enabled)}
            </div>
          </div>
        </summary>

        <div className="px-6 pb-6 pt-0">
          <div className="mt-4 grid gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                className="checkbox"
                checked={settingsForm.context_optimizer_enabled}
                onChange={(e) =>
                  setSettingsForm((value) => ({ ...value, context_optimizer_enabled: e.target.checked }))
                }
                type="checkbox"
              />
              활성화하다. ContextOptimizer（영향. Prompt 미리 보기 및 생성.
            </label>
            <div className="text-[11px] text-subtext">참고: 작성 페이지의 ‘문맥 미리보기’에서는 최적화된 요약 내용을 확인할 수 있습니다. diff。</div>
          </div>
        </div>
      </details>

      <details className="panel" aria-label="협업 구성원 (프로젝트 참여자)">
        <summary className="ui-focus-ring ui-transition-fast cursor-pointer select-none p-6">
          <div className="grid gap-1">
            <div className="font-content text-xl text-ink">협업 참여자 (협업 참여자)Project Memberships）</div>
            <div className="text-xs text-subtext">
              프로젝트. owner 초대 가능합니다./역할 변경./회원 삭제; 비회원은 접근이 제한됩니다. 404（RBAC fail-closed）。
            </div>
            <div className="text-xs text-subtext">owner: {baselineProject.owner_user_id}</div>
          </div>
        </summary>

        <div className="px-6 pb-6 pt-0">
          {canManageMemberships ? (
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">초대. user_id</span>
                  <input
                    className="input"
                    id="invite_user_id"
                    name="invite_user_id"
                    value={inviteUserId}
                    onChange={(e) => onChangeInviteUserId(e.target.value)}
                    placeholder="admin"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-subtext">역할.</span>
                  <select
                    className="select"
                    id="invite_role"
                    name="invite_role"
                    value={inviteRole}
                    onChange={(e) => onChangeInviteRole(e.target.value === "editor" ? "editor" : "viewer")}
                  >
                    <option value="viewer">{humanizeMemberRole("viewer")}</option>
                    <option value="editor">{humanizeMemberRole("editor")}</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary"
                    disabled={membershipSaving || membershipsLoading}
                    onClick={onInviteMember}
                    type="button"
                  >
                    초대.
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={membershipSaving || membershipsLoading}
                    onClick={onLoadMemberships}
                    type="button"
                  >
                    {membershipsLoading ? "새로 고침 중…" : "새로 고침."}
                  </button>
                </div>
              </div>

              <div className="overflow-auto rounded-atelier border border-border bg-canvas">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-subtext">
                    <tr>
                      <th className="px-3 py-2">user_id</th>
                      <th className="px-3 py-2">display_name</th>
                      <th className="px-3 py-2">role</th>
                      <th className="px-3 py-2">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((membership) => {
                      const memberUserId = membership.user?.id ?? "";
                      const isOwnerRow = memberUserId === baselineProject.owner_user_id || membership.role === "owner";
                      return (
                        <tr key={memberUserId} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{memberUserId}</td>
                          <td className="px-3 py-2">{membership.user?.display_name ?? "-"}</td>
                          <td className="px-3 py-2">
                            {isOwnerRow ? (
                              <span className="text-xs text-subtext">{humanizeMemberRole("owner")}</span>
                            ) : (
                              <select
                                className="select"
                                name="member_role"
                                value={membership.role === "editor" ? "editor" : "viewer"}
                                disabled={membershipSaving || membershipsLoading}
                                onChange={(e) =>
                                  onUpdateMemberRole(memberUserId, e.target.value === "editor" ? "editor" : "viewer")
                                }
                              >
                                <option value="viewer">{humanizeMemberRole("viewer")}</option>
                                <option value="editor">{humanizeMemberRole("editor")}</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isOwnerRow ? (
                              <span className="text-xs text-subtext">-</span>
                            ) : (
                              <button
                                className="btn btn-secondary"
                                disabled={membershipSaving || membershipsLoading}
                                onClick={() => onRemoveMember(memberUserId)}
                                type="button"
                              >
                                제거하다.
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {memberships.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-xs text-subtext" colSpan={4}>
                          현재 멤버 정보가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-xs text-subtext">
              해당 프로젝트만. owner（{baselineProject.owner_user_id}）관리 가능한 멤버; 현재 사용자:{currentUserId}。
            </div>
          )}
        </div>
      </details>
    </>
  );
}
