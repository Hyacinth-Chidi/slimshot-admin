import { CategoryTree } from '@/components/categories/category-tree';

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text">Categories</h1>
      <CategoryTree />
    </div>
  );
}
