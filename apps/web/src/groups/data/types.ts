// 7 个执行组共享的特性数据类型；各组数据文件从 './types' 导入。
export type FeatureEntry = { level: number; name: string; note?: string };
export type GroupFeatureData = {
 classFeatures: Record<string, FeatureEntry[]>;
 classNotes: Record<string, string>;
 subclassFeatures: Record<string, FeatureEntry[]>;
 speciesFeatures: Record<string, string[]>;
};
