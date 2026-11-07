import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

test('native container conditionals cannot leak strings or numbers into JSX', () => {
  const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
  assert.ok(configPath);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const violations: string[] = [];
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || !source.fileName.endsWith('.tsx') || source.fileName.includes('node_modules')) continue;
    function visit(node: ts.Node) {
      if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
        && node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const type = checker.getTypeAtLocation(node.expression.left);
        const alternatives = type.isUnion() ? type.types : [type];
        if (alternatives.some(part => (part.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) !== 0)) {
          const location = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(`${source.fileName}:${location.line + 1} — convert the JSX condition to a boolean`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(violations, [], 'A falsy string or number becomes a raw text child of View on React Native Web');
});
