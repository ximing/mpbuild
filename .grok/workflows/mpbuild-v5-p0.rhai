let meta = #{
    name: "mpbuild-v5-p0",
    description: "Run one P0 TDD task then review it",
    when_to_use: "Implement or review a single mpbuild v5 P0 plan task",
    phases: [
        #{ title: "Implement", detail: "TDD one plan task and commit" },
        #{ title: "Review", detail: "Spec and quality gate" },
    ],
};

let impl_schema = #{
    "type": "object",
    "required": ["status", "commit", "tests"],
    "properties": #{
        "status": #{ "type": "string" },
        "commit": #{ "type": "string" },
        "tests": #{ "type": "string" },
        "concerns": #{ "type": "string" },
    },
};

let review_schema = #{
    "type": "object",
    "required": ["spec_ok", "quality_ok", "summary"],
    "properties": #{
        "spec_ok": #{ "type": "boolean" },
        "quality_ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
    },
};

let task = if args == () { () } else { args.task };
if task == () { pause("verification", "Pass args.task as a number 1-9 for the P0 plan task."); }

let plan = "docs/superpowers/plans/2026-08-19-mpbuild-v5-p0-graph-kernel.md";
let spec = "docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md";

phase("Implement");
let impl_prompt = "";
impl_prompt += "Read ";
impl_prompt += plan;
impl_prompt += " and implement ONLY Task ";
impl_prompt += task.to_string();
impl_prompt += ". Follow TDD: write the failing test, run it, write minimal code, run tests, commit. ";
impl_prompt += "Read the spec at ";
impl_prompt += spec;
impl_prompt += " for types. Do not copy next/. Do not add Co-authored-by or mention AI in commits. ";
impl_prompt += "Use git -c trailer.ifexists=doNothing commit -m 'feat: ...' with a human conventional message. ";
impl_prompt += "Return status (DONE or BLOCKED), commit sha+subject, tests summary, concerns.";

let impl = agent(impl_prompt, #{
    label: "implement-task",
    capability_mode: "all",
    output_schema: impl_schema,
});

if impl == () || !impl.success || impl.output.status == () {
    complete(#{ summary: "implementer failed", ok: false });
}

if impl.output.status != "DONE" {
    complete(#{
        summary: "implementer not DONE",
        ok: false,
        status: impl.output.status,
        concerns: impl.output.concerns,
    });
}

phase("Review");
let rev_prompt = "";
rev_prompt += "Read ";
rev_prompt += plan;
rev_prompt += " Task ";
rev_prompt += task.to_string();
rev_prompt += " and git log -1 plus git diff HEAD~1. Decide spec_ok and quality_ok. ";
rev_prompt += "Require TDD evidence in the tree (tests exist and match the plan). Fail closed.";

let rev = agent(rev_prompt, #{
    label: "review-task",
    capability_mode: "read-only",
    output_schema: review_schema,
});

if rev == () || !rev.success || rev.output.spec_ok != true || rev.output.quality_ok != true {
    complete(#{
        summary: "review failed or not approved",
        ok: false,
        impl: impl.output,
        review: if rev == () || !rev.success { () } else { rev.output },
    });
}

complete(#{
    summary: "Task passed implement and review",
    ok: true,
    impl: impl.output,
    review: rev.output,
});
