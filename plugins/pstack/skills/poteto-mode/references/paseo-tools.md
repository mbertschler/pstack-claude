# pstack subagents run as Paseo agents

When `PASEO_AGENT_ID` is set in the environment, this session runs inside Paseo. Then every subagent a pstack skill dispatches runs as a Paseo agent through the paseo MCP tools, so the user can watch, message and stop it in Paseo. Translate each `Agent` call a pstack skill prescribes as below; everything else in the skill stays as written. Without `PASEO_AGENT_ID`, use the `Agent` tool as the skills say.

## Dispatch: `Agent` becomes `create_agent`

| `Agent` field | `create_agent` field |
| --- | --- |
| `model` | `provider`: `claude/<model ID>`, with the ID of the newest model of the family the role names, as `list_models` for provider `claude` lists them. `inherit-parent`, `auto` or no model: this session's model. |
| effort (`@<level>`, or the `default effort` line) | `settings.thinkingOptionId`: the level. For `session` or no level, this session's `effectiveThinkingOptionId`. Always set it, because Paseo's per-model default differs from this session's. |
| permission mode | `settings.modeId`: this session's `currentModeId`. |
| `subagent_type` | Opening of `initialPrompt`, see below. |
| `prompt` | Rest of `initialPrompt`. A `readonly: true` role adds "Do not write or edit files." |
| `description` | `title`, at most 60 characters, naming the skill and role, such as `how explorer: bid shading path`. Add `labels: {"pstack": "<skill>", "role": "<role>"}`. |
| `run_in_background: true` | Keep `notifyOnFinish` on and continue. Never poll. A delegate that needs the result for its own report waits instead, see [Wait inside the turn](#wait-inside-the-turn). |
| `isolation: "worktree"` | See [Workspaces for writing delegates](#workspaces-for-writing-delegates). Without isolation, omit `workspaceId`, so the agent shares this workspace. |
| N parallel subagents | N `create_agent` calls in one response. |

Read this session's model, `effectiveThinkingOptionId` and `currentModeId` once with `get_agent_status` on `$PASEO_AGENT_ID`.

The opening of `initialPrompt` replaces the subagent type. `<plugin>` is the pstack plugin root, three directories above this file.

- `pstack:poteto-agent` or `pstack:poteto-agent-<level>`: "You are a pstack poteto-agent delegate. Read `<plugin>/agents/poteto-agent.md` in full and follow it. The poteto-mode SKILL.md is at `<plugin>/skills/poteto-mode/SKILL.md`."
- `pstack:comment-sicko`, `pstack:thermo-nuclear-review-subagent`, `pstack:thermo-nuclear-code-quality-review-subagent`: "You are the pstack `<name>` subagent. Read `<plugin>/agents/<name>.md` in full and follow it as your instructions."
- `general-purpose`, `pstack:effort-<level>` or no type: no opening.

## Workspaces for writing delegates

Every visible workspace is an entry in the user's sidebar, so the sidebar should show the session they talk to and nothing else.

- **One writing delegate at a time:** omit `workspaceId`. The delegate works in this workspace on the session's branch, which is pstack's "exclusive branch" option. Commit your own changes first. Until the delegate reports, do not edit files, run tests or switch branches in this workspace.
- **Several delegates writing at the same time:** give each one a hidden worktree. First `create_workspace` with `isolation: "worktree"`, `background: true`, `mode: "branch-off"`, `baseBranch: "refs/heads/<current branch>"` and a `branchName`, then pass its `workspaceId`.
- **A delegate in another repository:** create one hidden worktree in that repository for the session the same way, with `path` set to that repository's checkout, and reuse it for every later delegate there. The one-writer-at-a-time rule applies inside it.
- **A worktree or branch that already exists:** pass the `workspaceId` of the workspace that holds it. `list_workspaces` with `includeBackground: true` lists hidden workspaces with their `cwd`. For a branch without a workspace, `create_workspace` with `isolation: "worktree"`, `mode: "checkout-branch"` and `branch`. Never make a worktree with `git worktree add`, and never pass a worktree folder to `create_workspace` with `isolation: "local"`: Paseo then registers the folder as a project of its own beside the repository's project, and that project stays in the sidebar after the worktree is gone.
- `background: true` on `create_workspace` hides only the workspace. The agent stays this session's subagent and shows in its Subagents track. Never pass `background: true` to `create_agent`, because that hides the agent from the Subagents track and from notifications.

## Results, follow-ups and stops

- The finish notification carries the agent's final message as `<agent-response>`. That is the subagent's report. Read more with `get_agent_activity` only when it is missing or cut off.
- Paseo notifies the parent only about a turn that the parent started. When a delegate ends its turn to wait for its own agent, the notification from that agent starts the delegate's next turn, and the end of that turn reaches nobody. Seen with Paseo 0.15.3: the coordinator got the delegate's "waiting" message and never its report.

### Wait inside the turn

A session that has a parent agent and dispatches Paseo agents whose results it needs before it reports never ends its turn to wait for them. It creates them with `notifyOnFinish: false` and waits in the foreground with a Bash timeout of 600000 milliseconds:

```bash
paseo wait <agent-id> --timeout 540 --json | jq -r .status
```

It repeats the command while it prints `timeout`. `paseo wait` exits 0 on a timeout too, so only the printed status tells the two apart. Then it reads the report with `get_agent_activity`.

### Watch a delegate that sent an interim message

When a notification carries an interim message instead of a report, such as "waiting for the review", no notification will bring the report. Read `get_agent_activity` first, and use the report when it is already there. Otherwise start this watch as a background Bash command with a timeout of 7200000 milliseconds. It ends when the delegate finishes a turn that ended after the watch started, and Claude Code then wakes the coordinator:

```bash
id=<agent-id>
seen=$(paseo inspect "$id" --json | jq -r .UpdatedAt)
until done_at=$(paseo inspect "$id" --json | jq -r 'select(.Status != "running" and .Status != "initializing") | .UpdatedAt') \
  && [ -n "$done_at" ] && [ "$done_at" != "$seen" ]; do
  sleep 30
done
```

Then read the report with `get_agent_activity`. If it is another interim message, start the watch again.
- A notification that an agent needs permission: leave it for the user to answer in Paseo and tell the user which agent waits.
- Resume or message an agent (`SendMessage`): `send_agent_prompt`.
- Stop an agent (`TaskStop`): `cancel_agent`, then confirm with `get_agent_status` that it has no `activeTurn`.
- Leave finished agents in Paseo for the user. Once a delegate's worktree is no longer needed, remove it with `archive_workspace` (which also archives its agents), never `git worktree remove`.
