-- CreateTable
CREATE TABLE "yacht_website_visibility" (
    "id" UUID NOT NULL,
    "yacht_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "yacht_website_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yacht_website_visibility_yacht_id_region_id_key" ON "yacht_website_visibility"("yacht_id", "region_id");

-- AddForeignKey
ALTER TABLE "yacht_website_visibility" ADD CONSTRAINT "yacht_website_visibility_yacht_id_fkey" FOREIGN KEY ("yacht_id") REFERENCES "yachts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yacht_website_visibility" ADD CONSTRAINT "yacht_website_visibility_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
