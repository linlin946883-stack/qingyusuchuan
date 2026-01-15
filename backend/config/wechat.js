/**
 * 微信支付配置
 * 
 * 获取配置信息的步骤：
 * 1. 登录微信商户平台 https://pay.weixin.qq.com
 * 2. 商户信息 -> API安全 下载证书
 * 3. 账户中心 -> 商户信息 获取商户号
 * 4. 小程序后台 -> 开发 -> 开发设置 获取AppID
 */

require('dotenv').config();

module.exports = {
  // 小程序 AppID
  appid: process.env.WECHAT_APPID || '',
  
  // 小程序密钥
  appSecret: process.env.WECHAT_APP_SECRET || '',
  
  // 商户号
  mchid: process.env.WECHAT_MCHID || '',
  
  // API v3 密钥（在商户平台设置）
  apiV3Key: process.env.WECHAT_API_V3_KEY || '',
  
  // 商户证书序列号
  serial_no: process.env.WECHAT_SERIAL_NO || '',
  
  // 商户私钥路径（相对于项目根目录）
  privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || './config/apiclient_key.pem',
  
  // 商户证书路径（相对于项目根目录）
  publicCertPath: process.env.WECHAT_PUBLIC_CERT_PATH || './config/apiclient_cert.pem',
  
  // 支付回调地址
  notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
  
  // 退款回调地址
  refundNotifyUrl: process.env.WECHAT_REFUND_NOTIFY_URL || '',
};
