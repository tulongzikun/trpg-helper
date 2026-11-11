const { test } = require('node:test');
const assert = require('node:assert/strict');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const common = require('../packages/contracts/schemas/common.schema.json');
const schemas = {
  draft: require('../packages/contracts/schemas/character-draft.schema.json'),
  snapshot: require('../packages/contracts/schemas/character-snapshot.schema.json'),
  monster: require('../packages/contracts/schemas/monster-entry.schema.json'),
};
const examples = {
  draft: require('../packages/contracts/examples/character-draft.json'),
  snapshot: require('../packages/contracts/examples/character-snapshot.json'),
  monster: require('../packages/contracts/examples/monster-entry.json'),
};
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(common);
const validators = Object.fromEntries(Object.entries(schemas).map(([key, schema]) => [key, ajv.compile(schema)]));

test('example documents match their respective schemas', () => {
  for (const key of Object.keys(examples)) assert.ok(validators[key](examples[key]), JSON.stringify(validators[key].errors));
});
test('drafts cannot pass the published snapshot boundary', () => {
  assert.equal(validators.snapshot(examples.draft), false);
});
test('snapshot rejects runtime battle state', () => {
  const value = structuredClone(examples.snapshot);
  value.currentHp = 2;
  assert.equal(validators.snapshot(value), false);
});
test('monster rejects malformed CR and incomplete abilities', () => {
  const value = structuredClone(examples.monster);
  value.statBlocks[0].challengeRating = '1/3';
  delete value.statBlocks[0].abilities.dex;
  assert.equal(validators.monster(value), false);
  assert.ok(validators.monster.errors.length >= 2);
});
test('unknown monster fields cannot silently disappear', () => {
  const value = structuredClone(examples.monster);
  value.statBlocks[0].unknownField = 'data';
  assert.equal(validators.monster(value), false);
});
test('catalog entries are valid and stat block IDs are unique', () => {
  const catalog = require('../apps/web/src/data/monsters.json');
  const ids = new Set();
  for (const entry of catalog) {
    assert.ok(validators.monster(entry), JSON.stringify(validators.monster.errors));
    for (const block of entry.statBlocks) {
      assert.ok(!ids.has(block.id), `duplicate stat block id: ${block.id}`);
      ids.add(block.id);
    }
  }
});
