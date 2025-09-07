#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

// Fonction pour corriger un fichier
function fixFile(filePath) {
  console.log(`🔧 Correction de: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Supprimer les variables Async et Sync inexistantes
  if (content.includes('Async') || content.includes('Sync')) {
    // Remplacer les destructurations avec Async/Sync
    content = content.replace(
      /const\s*{\s*([^}]*?)\s*,\s*Async\s*([^}]*?)\s*}\s*=\s*useAuth\(\)/g,
      (match, before, after) => {
        const newBefore = before.replace(/,\s*$/, '');
        const newAfter = after.replace(/^\s*,/, '');
        return `const { ${newBefore}${newAfter ? ', ' : ''}${newAfter} } = useAuth()`;
      }
    );
    
    content = content.replace(
      /const\s*{\s*([^}]*?)\s*,\s*Sync\s*([^}]*?)\s*}\s*=\s*useAuth\(\)/g,
      (match, before, after) => {
        const newBefore = before.replace(/,\s*$/, '');
        const newAfter = after.replace(/^\s*,/, '');
        return `const { ${newBefore}${newAfter ? ', ' : ''}${newAfter} } = useAuth()`;
      }
    );
    
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigé: ${filePath}`);
  } else {
    console.log(`⏭️  Pas de correction nécessaire: ${filePath}`);
  }
}

// Trouver tous les fichiers TypeScript/React
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: [
    'src/hooks/useAuth.ts', // Ne pas corriger le hook lui-même
  ]
});

console.log(`🚀 Correction des variables Async/Sync dans ${files.length} fichiers...\n`);

files.forEach(fixFile);

console.log('\n🎉 Correction terminée !');
