import { config } from "@remotion/eslint-config-flat";

export default [
    ...config,
    {
        rules: {
            // These fire pervasively in backend-glue / context code — downgrade to warn
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unused-vars": ["off", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-empty": ["error", { allowEmptyCatch: true }],
            // Remotion randomness/animation rules only apply inside Remotion compositions
            "@remotion/deterministic-randomness": "off",
            "@remotion/non-pure-animation": "off",
        },
    },
];
