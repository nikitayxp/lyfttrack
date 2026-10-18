const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

module.exports = function createSourceLoader(replacements = {}, globals = {}) {
  const cache = new Map();
  const root = path.resolve(__dirname, '../..');

  function load(file) {
    const absolutePath = path.resolve(root, file);
    if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
    const source = fs.readFileSync(absolutePath, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const sourceModule = { exports: {} };
    cache.set(absolutePath, sourceModule);

    function sourceRequire(name) {
      if (Object.hasOwn(replacements, name)) return replacements[name];
      if (name.startsWith('@/')) {
        const base = `app/src/${name.slice(2)}`;
        return load(fs.existsSync(path.resolve(root, `${base}.ts`)) ? `${base}.ts` : `${base}.tsx`);
      }
      if (name.startsWith('.')) {
        return load(path.relative(root, path.resolve(path.dirname(absolutePath), name)));
      }
      return require(name);
    }

    vm.runInNewContext(compiled, {
      require: sourceRequire,
      module: sourceModule,
      exports: sourceModule.exports,
      console,
      Date: globals.Date ?? Date,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    }, { filename: absolutePath });
    return sourceModule.exports;
  }

  return load;
};
