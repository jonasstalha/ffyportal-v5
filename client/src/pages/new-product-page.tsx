import { NewProductEntry } from "@/components/product/NewProductEntry";

export default function NewProductPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Add New Product</h1>
      <NewProductEntry />
    </div>
  );
} 