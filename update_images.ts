import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (p.image && p.image.includes('res.cloudinary.com/demo')) {
      await prisma.product.update({
        where: { id: p.id },
        data: { image: p.image.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5') }
      });
    }
  }

  const categories = await prisma.category.findMany();
  for (const c of categories) {
    if (c.image && c.image.includes('res.cloudinary.com/demo')) {
      await prisma.category.update({
        where: { id: c.id },
        data: { image: c.image.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5') }
      });
    }
  }

  const collections = await prisma.collection.findMany();
  for (const c of collections) {
    if (c.image && c.image.includes('res.cloudinary.com/demo')) {
      await prisma.collection.update({
        where: { id: c.id },
        data: { image: c.image.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5') }
      });
    }
  }

  const images = await prisma.productImage.findMany();
  for (const i of images) {
    if (i.url.includes('res.cloudinary.com/demo')) {
      await prisma.productImage.update({
        where: { id: i.id },
        data: { url: i.url.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5') }
      });
    }
  }

  const home = await prisma.homeContent.findFirst();
  if (home) {
    await prisma.homeContent.update({
      where: { id: home.id },
      data: {
        heroImage: home.heroImage?.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5'),
        editorialImage: home.editorialImage?.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5'),
        videoPoster: home.videoPoster?.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5'),
      }
    });
  }

  const features = await prisma.homeFeature.findMany();
  for (const f of features) {
    if (f.image && f.image.includes('res.cloudinary.com/demo')) {
      await prisma.homeFeature.update({
        where: { id: f.id },
        data: { image: f.image.replace('res.cloudinary.com/demo', 'res.cloudinary.com/dulodorz5') }
      });
    }
  }
}

main().then(() => console.log("Done")).catch(console.error).finally(() => prisma.$disconnect());
