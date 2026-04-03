-- CreateTable
CREATE TABLE "blog_region_visibility" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blog_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,

    CONSTRAINT "blog_region_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_region_visibility_blog_id_region_id_key" ON "blog_region_visibility"("blog_id", "region_id");

-- AddForeignKey
ALTER TABLE "blog_region_visibility" ADD CONSTRAINT "blog_region_visibility_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_region_visibility" ADD CONSTRAINT "blog_region_visibility_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
