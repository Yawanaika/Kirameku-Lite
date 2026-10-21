import { count, desc } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { visitor } from "@/server/db/schema";
import type {
  VisitorGeo,
  VisitorItem,
  VisitorListParams,
} from "./contracts";

const PROVINCE_MAP: Record<string, string> = {
  beijing: "北京",
  tianjin: "天津",
  shanghai: "上海",
  chongqing: "重庆",
  hebei: "河北",
  shanxi: "山西",
  "inner mongolia": "内蒙古",
  liaoning: "辽宁",
  jilin: "吉林",
  heilongjiang: "黑龙江",
  jiangsu: "江苏",
  zhejiang: "浙江",
  anhui: "安徽",
  fujian: "福建",
  jiangxi: "江西",
  shandong: "山东",
  henan: "河南",
  hubei: "湖北",
  hunan: "湖南",
  guangdong: "广东",
  guangxi: "广西",
  hainan: "海南",
  sichuan: "四川",
  guizhou: "贵州",
  yunnan: "云南",
  tibet: "西藏",
  shaanxi: "陕西",
  gansu: "甘肃",
  qinghai: "青海",
  ningxia: "宁夏",
  xinjiang: "新疆",
  "hong kong": "香港",
  macau: "澳门",
  taiwan: "台湾",
};

const VENDOR_MAP: Record<string, string> = {
  alibaba: "阿里巴巴",
  aliyun: "阿里云",
  tencent: "腾讯",
  "tencent cloud": "腾讯云",
  baidu: "百度",
  "baidu cloud": "百度云",
  huawei: "华为",
  "huawei cloud": "华为云",
  bytedance: "字节跳动",
  volcengine: "火山引擎",
  kuaishou: "快手",
  meituan: "美团",
  xiaomi: "小米",
  "jd.com": "京东",
  netease: "网易",
  kingsoft: "金山云",
  "qihoo 360": "奇虎360",
  sina: "新浪",
  sohu: "搜狐",
  douban: "豆瓣",
  amazon: "亚马逊",
  aws: "亚马逊云",
  microsoft: "微软",
  azure: "微软云",
  google: "谷歌",
  "google cloud": "谷歌云",
  cloudflare: "Cloudflare",
  oracle: "甲骨文",
  ovh: "OVH",
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  apple: "苹果",
};

const ASN_ORG_MAP: Record<string, string> = {
  "56041": "中国移动",
  "56042": "中国移动",
  "56043": "中国移动",
  "56044": "中国移动",
  "56045": "中国移动",
  "56046": "中国移动",
  "56047": "中国移动",
  "56048": "中国移动",
  "58453": "中国移动",
  "9808": "中国移动",
  "24400": "中国移动",
  "24444": "中国移动",
  "24445": "中国移动",
  "4808": "中国联通",
  "4837": "中国联通",
  "9929": "中国联通",
  "17816": "中国联通",
  "4134": "中国电信",
  "4809": "中国电信",
  "4812": "中国电信",
  "23724": "中国电信",
  "140061": "中国电信",
  "4538": "中国教育网",
  "45102": "阿里云",
  "37963": "阿里云",
  "45090": "阿里云",
  "45069": "腾讯云",
  "132203": "腾讯云",
  "136907": "华为云",
  "55967": "百度云",
  "137696": "火山引擎",
  "13335": "Cloudflare",
  "209242": "Cloudflare",
};

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device_type: string;
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  let browser = "Unknown";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  const deviceType = /Mobi|Android|iPhone/i.test(ua) ? "手机" : "电脑";

  return { browser, os, device_type: deviceType };
}

export function getOrgCn(org: string, asn: string): string {
  if (!org) return "";

  const orgLower = org.toLowerCase().replaceAll(",", "").replaceAll(".", "").replaceAll("&", "and");

  let foundProvince = "";
  for (const [eng, cn] of Object.entries(PROVINCE_MAP)) {
    if (orgLower.includes(eng)) {
      foundProvince = cn;
      break;
    }
  }

  const isMobile =
    orgLower.includes("china mobile") ||
    orgLower.includes("chinamobile") ||
    orgLower.includes("cmcc");
  const isUnicom =
    orgLower.includes("china unicom") ||
    orgLower.includes("chinaunicom") ||
    orgLower.includes("cucc");
  const isTelecom =
    orgLower.includes("china telecom") ||
    orgLower.includes("chinatelecom") ||
    orgLower.includes("chinanet") ||
    orgLower.includes("ctcc");
  const isCernet =
    orgLower.includes("cernet") ||
    orgLower.includes("cernt") ||
    orgLower.includes("china education");

  if (isMobile) return foundProvince ? `中国移动(${foundProvince})` : "中国移动";
  if (isUnicom) return foundProvince ? `中国联通(${foundProvince})` : "中国联通";
  if (isTelecom) return foundProvince ? `中国电信(${foundProvince})` : "中国电信";
  if (isCernet) return "中国教育网";

  if (orgLower.includes("mobile") || org.includes("移动")) {
    return foundProvince ? `${foundProvince}移动` : "移动运营商";
  }
  if (
    orgLower.includes("unicom") ||
    orgLower.includes("united network") ||
    orgLower.includes("uninet")
  ) {
    return foundProvince ? `${foundProvince}联通` : "中国联通";
  }
  if (
    orgLower.includes("telecom") ||
    orgLower.includes("chinanet") ||
    orgLower.includes("telecommunications")
  ) {
    return foundProvince ? `${foundProvince}电信` : "中国电信";
  }
  if (orgLower.includes("netcom") || orgLower.includes("cnc")) {
    return "中国网通";
  }

  if (orgLower.includes("cable")) {
    return foundProvince ? `${foundProvince}广电` : "有线电视网络";
  }
  if (
    orgLower.includes("broadcast") ||
    orgLower.includes("radio") ||
    orgLower.includes("tv")
  ) {
    return foundProvince ? `${foundProvince}广电` : "广电网络";
  }
  if (orgLower.includes("huashu") || orgLower.includes("wasu")) {
    return "华数传媒";
  }
  if (
    orgLower.includes("inter-exchange") ||
    orgLower.includes("interexchange")
  ) {
    return "互联交换网络";
  }
  if (orgLower.includes("china networks")) {
    return "中国网络交换";
  }

  for (const [keyword, cnName] of Object.entries(VENDOR_MAP)) {
    if (orgLower.includes(keyword)) return cnName;
  }

  if (asn) {
    const asnNumber = asn.replaceAll("AS", "").replaceAll("as", "").trim();
    if (ASN_ORG_MAP[asnNumber]) return ASN_ORG_MAP[asnNumber];

    const asnLower = asn.toLowerCase();
    if (
      asnLower.includes("china mobile") ||
      asnLower.includes("chinamobile") ||
      asnLower.includes("cmcc")
    ) {
      return "中国移动";
    }
    if (
      asnLower.includes("china unicom") ||
      asnLower.includes("chinaunicom")
    ) {
      return "中国联通";
    }
    if (
      asnLower.includes("china telecom") ||
      asnLower.includes("chinatelecom") ||
      asnLower.includes("chinanet")
    ) {
      return "中国电信";
    }
  }

  return "";
}

const geoCache = new Map<string, VisitorGeo>();

function isPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === "unknown" ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Resolve an IP through the same two providers the legacy FastAPI service used.
 * Private/local addresses never leave the process. Failures degrade to an empty
 * object so visitor recording still succeeds.
 */
export async function fetchVisitorGeo(ip: string): Promise<Partial<VisitorGeo>> {
  if (isPrivateIp(ip)) return {};
  const cached = geoCache.get(ip);
  if (cached) return cached;

  let result: Partial<VisitorGeo> = {};

  try {
    const response = await fetch(
      `https://uapis.cn/api/v1/network/ipinfo?ip=${encodeURIComponent(ip)}`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" },
    );
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      if (data.ip) {
        const parts = asString(data.region).split(/\s+/).filter(Boolean);
        result = {
          country: parts[0] ?? "",
          region: parts[1] ?? "",
          city: parts[2] ?? "",
          district: "",
          org: asString(data.isp),
          asn: asString(data.asn) || asString(data.as),
          is_mobile: false,
          is_proxy: false,
          is_hosting: false,
        };
      }
    }
  } catch {
    // Try the IPv4 fallback below.
  }

  if (Object.keys(result).length === 0 && !ip.includes(":")) {
    try {
      const response = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=66846719`,
        { signal: AbortSignal.timeout(3000), cache: "no-store" },
      );
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        if (data.status === "success") {
          result = {
            city: asString(data.city),
            region: asString(data.regionName),
            country: asString(data.country),
            district: asString(data.district),
            org: asString(data.org) || asString(data.isp),
            asn: asString(data.as),
            is_mobile: Boolean(data.mobile),
            is_proxy: Boolean(data.proxy),
            is_hosting: Boolean(data.hosting),
          };
        }
      }
    } catch {
      // Keep the empty result.
    }
  }

  if (Object.keys(result).length > 0) {
    if (geoCache.size > 1000) {
      const firstKey = geoCache.keys().next().value;
      if (firstKey) geoCache.delete(firstKey);
    }
    geoCache.set(ip, result as VisitorGeo);
  }
  return result;
}

function toItem(row: typeof visitor.$inferSelect): VisitorItem {
  return {
    id: row.id,
    ip: row.ip,
    path: row.path ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    country: row.country ?? "",
    district: row.district ?? "",
    org: row.org ?? "",
    org_cn: getOrgCn(row.org ?? "", row.asn ?? ""),
    asn: row.asn ?? "",
    is_mobile: row.isMobile ?? false,
    is_proxy: row.isProxy ?? false,
    is_hosting: row.isHosting ?? false,
    browser: row.browser ?? "",
    os: row.os ?? "",
    device_type: row.deviceType ?? "",
    created_at: row.createdAt?.toISOString() ?? "",
  };
}

export interface VisitorsServiceOptions {
  fetchGeo?: (ip: string) => Promise<Partial<VisitorGeo>>;
}

export function createVisitorsService(
  db: AppDatabase,
  options: VisitorsServiceOptions = {},
) {
  const resolveGeo = options.fetchGeo ?? fetchVisitorGeo;

  return {
    async record(input: {
      ip: string;
      path?: string;
      userAgent?: string;
    }): Promise<void> {
      const userAgent = input.userAgent ?? "";
      const parsed = parseUserAgent(userAgent);
      const geo = await resolveGeo(input.ip);

      await db.insert(visitor).values({
        ip: input.ip,
        path: (input.path ?? "").slice(0, 500),
        userAgent,
        city: geo.city ?? "",
        region: geo.region ?? "",
        country: geo.country ?? "",
        district: geo.district ?? "",
        org: geo.org ?? "",
        asn: geo.asn ?? "",
        isMobile: geo.is_mobile ?? false,
        isProxy: geo.is_proxy ?? false,
        isHosting: geo.is_hosting ?? false,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.device_type,
        createdAt: new Date(),
      });
    },

    async list(params: VisitorListParams): Promise<VisitorItem[]> {
      const rows = await db
        .select()
        .from(visitor)
        .orderBy(desc(visitor.createdAt), desc(visitor.id))
        .limit(params.size)
        .offset((params.page - 1) * params.size);

      return rows.map(toItem);
    },

    async count(): Promise<number> {
      const [row] = await db.select({ value: count() }).from(visitor);
      return row?.value ?? 0;
    },

    async location(ip: string): Promise<Partial<VisitorGeo>> {
      return resolveGeo(ip);
    },
  };
}

export type VisitorsService = ReturnType<typeof createVisitorsService>;
