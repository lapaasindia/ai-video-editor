import { config } from "@remotion/eslint-config-flat";

export default [
    ...config,
    {
        rules: {
            // These fire pervasively in backend-glue / context code — downgrade to warn
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/ban-ts-comment": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-empty": ["error", { allowEmptyCatch: true }],
            // Remotion randomness/animation rules only apply inside Remotion compositions
            "@remotion/deterministic-randomness": "warn",
            "@remotion/non-pure-animation": "warn",
        },
    },
];
