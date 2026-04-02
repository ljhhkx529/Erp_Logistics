-- 🏗️ 重新构建本地表结构 (本地测试用)

-- 删除旧表
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS outbound_batches;

-- 创建新版包裹表 (增加货值，去除重量)
CREATE TABLE shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_number TEXT UNIQUE NOT NULL,
  client_name TEXT,
  product_name TEXT,
  value_rmb REAL DEFAULT 0,
  status INTEGER DEFAULT 0,
  destination TEXT,
  warehouse TEXT,
  quantity INTEGER DEFAULT 1,
  photo_base64 TEXT,
  outbound_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建新版发货批次表 (自定义 ID 驱动，增加打包参数)
CREATE TABLE outbound_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_tracking TEXT UNIQUE NOT NULL, -- 你的 Archi-XX / Ira-XX
  package_type TEXT,
  insurance_type TEXT,
  packed_weight REAL DEFAULT 0,
  packed_volume REAL DEFAULT 0,
  is_manifested INTEGER DEFAULT 0,
  status INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);