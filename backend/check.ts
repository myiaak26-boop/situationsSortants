import { prisma } from './src/lib/prisma.js'

async function main() {
  const count = await prisma.courrier.count();
  console.log('Total courriers in DB:', count);

  const courriers = await prisma.courrier.findMany();
  const numbers = {};
  
  courriers.forEach((c) => {
    numbers[c.numero] = (numbers[c.numero] || 0) + 1;
  });

  const dups = Object.entries(numbers).filter(x => x[1] > 1);
  console.log('Duplicated numbers in DB:', dups.length);
  if (dups.length > 0) {
    console.log('Top dups:', dups.slice(0, 5));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
