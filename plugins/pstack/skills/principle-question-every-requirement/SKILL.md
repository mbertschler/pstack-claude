---
name: principle-question-every-requirement
description: "Apply before you design or build anything nontrivial, including work handed over as fully specified, and whenever a new requirement turns up during the work. Write the requirements down, your own readings included, and question each one before it shapes the design."
user-invocable: false
---

# Question Every Requirement

Every requirement can be wrong, whoever set it: the user, a task, a doc, a brief, a reviewer or you. Assume every requirement handed to you is flawed. No instruction exempts one from being questioned, shrunk or dropped, however precise the spec or design, and even when a brief or handoff says to implement and not redesign. This holds for every session and every delegate, however narrow its task, because whoever writes the code and tests sees best what a requirement costs. The readings you add yourself cost the most, because nobody else sees them.

- Before you design, write the requirements down, including every reading you add.
- Start with the user's own statements, such as a task's goals and principles and what the user says during the session. The user states them without working through every case.
- Ask of each one what it buys, what it costs and whether a nearby version serves the same intent at a fraction of the cost. Shrink or drop it where the answers say so, before you build it rather than in a note afterwards.
- An expensive "never", "always" or "every" is a goal. Name the cases you leave out.
- Question a requirement that turns up during the work the same way, such as a review finding.
- Decide by yourself. Report what you dropped at the end, as options with what each would add.
- Give the list to every design runner, judge and reviewer, and put it into the pull request's Scope section.

Then delete what no requirement needs, per [Subtract Before You Add](../principle-subtract-before-you-add/SKILL.md), before you simplify or fix anything.

Distinct from [Attack the Premise](../principle-attack-the-premise/SKILL.md), which questions a fact the design assumes after fixes have failed. This principle questions what the design must do, before the design exists.
