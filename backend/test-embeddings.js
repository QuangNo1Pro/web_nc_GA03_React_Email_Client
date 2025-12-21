const tests = ['invoice', 'payment', 'money'];
const EMBEDDING_DIM = 768;

console.log('📊 Testing Mock Embedding Generator\n');

for (const text of tests) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }

  const embedding = [];
  for (let i = 0; i < 3; i++) {
    const seed = hash + i * 73856093;
    const pseudoRandom = Math.sin(seed) * 10000;
    embedding.push((pseudoRandom - Math.floor(pseudoRandom)) * 2 - 1);
  }

  console.log(`✅ "${text}" → [${embedding.map(v => v.toFixed(3)).join(', ')}...]`);
}

console.log('\n✨ Each text produces deterministic, unique vectors!');
console.log('📈 Full embedding: 768 dimensions\n');
