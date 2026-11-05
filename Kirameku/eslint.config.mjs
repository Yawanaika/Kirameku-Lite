import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 以 `_` 开头的形参/变量表示「按契约必须存在但未使用」，不必再逐处 disable。
      // 设为 error 而不是 warn：CI 现在会跑 lint，warn 级别等于没有门禁。
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // public/ 是原样拷贝的第三方运行库（Live2D 等）与静态资源，不属于本仓库的源码。
    "public/**",
  ]),
]);

export default eslintConfig;
