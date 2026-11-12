// Individual 2024 tool proficiencies; gaming sets and instruments are separate choices.
export const tools2024=['炼金工具','酿酒工具','书法工具','木匠工具','绘图工具','制鞋工具','厨具','玻璃匠工具','珠宝工具','皮匠工具','石匠工具','画具','陶工工具','铁匠工具','修补匠工具','织布工具','木雕工具','易容工具','伪造工具','草药工具','导航工具','制毒工具','盗贼工具','骰子','龙棋','纸牌','三龙骰','风笛','鼓','扬琴','长笛','号角','鲁特琴','里拉琴','排箫','肖姆管','维奥尔琴'] as const;

export const artisanTools:readonly string[]=tools2024.slice(0,17);
export const gamingSets:readonly string[]=tools2024.slice(23,27);
export const musicalInstruments:readonly string[]=tools2024.slice(27);
