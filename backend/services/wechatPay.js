/**
 * 微信支付服务类
 * 提供微信支付的核心功能：创建订单、查询订单、关闭订单、退款等
 */

const fs = require('fs');
const path = require('path');
const WxPay = require('wechatpay-node-v3');
const wechatConfig = require('../config/wechat');

class WeChatPayService {
  constructor() {
    this.pay = null;
    this.init();
  }

  /**
   * 初始化微信支付实例
   */
  init() {
    try {
      // 读取商户私钥
      const privateKey = fs.readFileSync(
        path.resolve(__dirname, '..', wechatConfig.privateKeyPath),
        'utf-8'
      );
      
      // 读取商户证书（公钥证书）
      const publicCert = fs.readFileSync(
        path.resolve(__dirname, '..', wechatConfig.publicCertPath),
        'utf-8'
      );

      this.pay = new WxPay({
        appid: wechatConfig.appid,
        mchid: wechatConfig.mchid,
        privateKey: privateKey,
        publicKey: publicCert,
        key: wechatConfig.apiV3Key,
      });

      console.log('✓ 微信支付服务初始化成功');
    } catch (error) {
      console.error('✗ 微信支付服务初始化失败:', error.message);
      console.log('提示: 请确保已配置微信支付证书和环境变量');
    }
  }

  /**
   * 创建JSAPI支付订单
   * @param {Object} params - 订单参数
   * @param {string} params.orderId - 商户订单号
   * @param {string} params.description - 商品描述
   * @param {number} params.total - 订单金额（分）
   * @param {string} params.openid - 用户openid
   * @returns {Promise<Object>} 返回支付参数
   */
  async createJsapiOrder(params) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    const { orderId, description, total, openid } = params;

    try {
      const result = await this.pay.transactions_jsapi({
        description: description || '充值',
        out_trade_no: orderId,
        notify_url: wechatConfig.notifyUrl,
        amount: {
          total: Math.floor(total), // 确保是整数
        },
        payer: {
          openid: openid,
        },
      });

      // 生成小程序支付参数
      const payParams = this.generatePayParams(result.prepay_id);
      
      return {
        ...payParams,
        prepay_id: result.prepay_id,
      };
    } catch (error) {
      console.error('创建支付订单失败:', error);
      throw new Error(`创建支付订单失败: ${error.message}`);
    }
  }

  /**
   * 生成小程序支付参数
   * @param {string} prepayId - 预支付ID
   * @returns {Object} 小程序支付参数
   */
  generatePayParams(prepayId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const packageStr = `prepay_id=${prepayId}`;

    // 生成签名
    const signStr = `${wechatConfig.appid}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
    const paySign = this.pay.getSignature('SHA256-RSA2048', signStr);

    return {
      timeStamp: timestamp,
      nonceStr: nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign: paySign,
    };
  }

  /**
   * 查询订单
   * @param {string} orderId - 商户订单号
   * @returns {Promise<Object>} 订单信息
   */
  async queryOrder(orderId) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    try {
      const result = await this.pay.query({
        out_trade_no: orderId,
      });
      return result;
    } catch (error) {
      console.error('查询订单失败:', error);
      throw new Error(`查询订单失败: ${error.message}`);
    }
  }

  /**
   * 关闭订单
   * @param {string} orderId - 商户订单号
   * @returns {Promise<Object>}
   */
  async closeOrder(orderId) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    try {
      const result = await this.pay.close({
        out_trade_no: orderId,
      });
      return result;
    } catch (error) {
      console.error('关闭订单失败:', error);
      throw new Error(`关闭订单失败: ${error.message}`);
    }
  }

  /**
   * 申请退款
   * @param {Object} params - 退款参数
   * @param {string} params.orderId - 商户订单号
   * @param {string} params.refundId - 退款单号
   * @param {number} params.total - 原订单金额（分）
   * @param {number} params.refund - 退款金额（分）
   * @param {string} params.reason - 退款原因
   * @returns {Promise<Object>}
   */
  async refund(params) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    const { orderId, refundId, total, refund, reason } = params;

    try {
      const result = await this.pay.refund({
        out_trade_no: orderId,
        out_refund_no: refundId,
        notify_url: wechatConfig.refundNotifyUrl,
        amount: {
          refund: Math.floor(refund),
          total: Math.floor(total),
          currency: 'CNY',
        },
        reason: reason || '用户申请退款',
      });
      return result;
    } catch (error) {
      console.error('申请退款失败:', error);
      throw new Error(`申请退款失败: ${error.message}`);
    }
  }

  /**
   * 查询退款
   * @param {string} refundId - 退款单号
   * @returns {Promise<Object>}
   */
  async queryRefund(refundId) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    try {
      const result = await this.pay.queryRefund({
        out_refund_no: refundId,
      });
      return result;
    } catch (error) {
      console.error('查询退款失败:', error);
      throw new Error(`查询退款失败: ${error.message}`);
    }
  }

  /**
   * 验证支付回调签名
   * @param {Object} headers - 请求头
   * @param {Object} body - 请求体
   * @returns {boolean}
   */
  verifySignature(headers, body) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    try {
      const signature = headers['wechatpay-signature'];
      const timestamp = headers['wechatpay-timestamp'];
      const nonce = headers['wechatpay-nonce'];
      const serial = headers['wechatpay-serial'];

      return this.pay.verifySign({
        signature,
        timestamp,
        nonce,
        body: JSON.stringify(body),
        serial,
      });
    } catch (error) {
      console.error('验证签名失败:', error);
      return false;
    }
  }

  /**
   * 解密回调数据
   * @param {Object} encryptedData - 加密数据
   * @returns {Object} 解密后的数据
   */
  decryptNotifyData(encryptedData) {
    if (!this.pay) {
      throw new Error('微信支付服务未初始化');
    }

    try {
      const { ciphertext, associated_data, nonce } = encryptedData;
      
      return this.pay.decipher_gcm(
        ciphertext,
        associated_data,
        nonce,
        wechatConfig.apiV3Key
      );
    } catch (error) {
      console.error('解密回调数据失败:', error);
      throw new Error(`解密回调数据失败: ${error.message}`);
    }
  }

  /**
   * 生成随机字符串
   * @param {number} length - 字符串长度
   * @returns {string}
   */
  generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成唯一订单号
   * @returns {string}
   */
  generateOrderId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `WX${year}${month}${day}${timestamp}${random}`;
  }
}

// 导出单例
module.exports = new WeChatPayService();
