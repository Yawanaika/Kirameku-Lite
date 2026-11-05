-- 媒体库一期：照片入库时把上传阶段已经算出来的元数据一并存下来。
-- 上传路径（server/storage/image.ts 的 inspectImage）本来就解析了宽高/格式/字节，
-- 之前只在响应用一次就丢了，导致后台无法回答「哪张图最占空间」。
-- 老数据留 NULL：宁可显示「未记录」，也不拿 0 冒充真实体积。
ALTER TABLE "photo" ADD COLUMN "width" INTEGER;
ALTER TABLE "photo" ADD COLUMN "height" INTEGER;
ALTER TABLE "photo" ADD COLUMN "bytes" INTEGER;
ALTER TABLE "photo" ADD COLUMN "format" TEXT;
