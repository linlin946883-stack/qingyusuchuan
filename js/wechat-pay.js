/**
 * 微信 JSAPI 支付工具类
 * 用于在微信浏览器中调起微信支付
 */

class WeChatPay {
  constructor() {
    this.isWeChatBrowser = this.checkWeChatBrowser();
  }

  /**
   * 检测是否在微信浏览器中
   */
  checkWeChatBrowser() {
    const ua = navigator.userAgent.toLowerCase();
    return /micromessenger/.test(ua);
  }

  /**
   * 获取微信 OpenID（如果已登录）
   */
  getOpenId() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.openid : null;
  }

  /**
   * 获取用户信息
   */
  getUserInfo() {
    try {
      const userInfoStr = localStorage.getItem('userInfo');
      return userInfoStr ? JSON.parse(userInfoStr) : null;
    } catch {
      return null;
    }
  }

  /**
   * 创建支付订单
   * @param {number} orderId - 业务订单ID
   * @param {number} amount - 支付金额（元）
   * @param {string} description - 商品描述
   * @returns {Promise<Object>} 支付参数
   */
  async createPayment(orderId, amount, description = '轻羽速传服务') {
    try {
      if (!this.isWeChatBrowser) {
        throw new Error('请在微信浏览器中打开');
      }

      const openid = this.getOpenId();
      if (!openid) {
        throw new Error('未获取到微信授权信息，请重新登录');
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`${window.API_BASE_URL}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderId,
          amount: amount,
          description: description
        })
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || '创建支付订单失败');
      }

      return result.data;
    } catch (error) {
      console.error('创建支付订单失败:', error);
      throw error;
    }
  }

  /**
   * 调起微信支付
   * @param {Object} payParams - 支付参数
   * @returns {Promise<Object>} 支付结果
   */
  async pay(payParams) {
    return new Promise((resolve, reject) => {
      if (!this.isWeChatBrowser) {
        reject(new Error('请在微信浏览器中打开'));
        return;
      }

      if (typeof WeixinJSBridge === 'undefined') {
        if (document.addEventListener) {
          document.addEventListener('WeixinJSBridgeReady', () => {
            this.invokePay(payParams, resolve, reject);
          }, false);
        } else if (document.attachEvent) {
          document.attachEvent('WeixinJSBridgeReady', () => {
            this.invokePay(payParams, resolve, reject);
          });
          document.attachEvent('onWeixinJSBridgeReady', () => {
            this.invokePay(payParams, resolve, reject);
          });
        }
      } else {
        this.invokePay(payParams, resolve, reject);
      }
    });
  }

  /**
   * 实际调起支付
   */
  invokePay(payParams, resolve, reject) {
    WeixinJSBridge.invoke('getBrandWCPayRequest', {
      appId: payParams.appId,
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign
    }, (res) => {
      if (res.err_msg === 'get_brand_wcpay_request:ok') {
        // 支付成功
        resolve({ success: true, message: '支付成功' });
      } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
        // 用户取消支付
        reject({ success: false, message: '用户取消支付', cancelled: true });
      } else {
        // 支付失败
        reject({ success: false, message: '支付失败：' + res.err_msg });
      }
    });
  }

  /**
   * 查询订单支付状态
   * @param {string} paymentOrderId - 支付订单号
   * @returns {Promise<Object>} 订单状态
   */
  async queryPaymentStatus(paymentOrderId) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`${window.API_BASE_URL}/payment/order/${paymentOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || '查询支付状态失败');
      }

      return result.data;
    } catch (error) {
      console.error('查询支付状态失败:', error);
      throw error;
    }
  }

  /**
   * 完整支付流程
   * @param {number} orderId - 业务订单ID
   * @param {number} amount - 支付金额（元）
   * @param {string} description - 商品描述
   * @returns {Promise<Object>} 支付结果
   */
  async executePay(orderId, amount, description) {
    try {
      // 1. 创建支付订单
      const payData = await this.createPayment(orderId, amount, description);
      
      // 2. 调起微信支付
      const result = await this.pay(payData.pay_params);
      
      // 3. 支付成功后可以查询订单状态确认
      // const status = await this.queryPaymentStatus(payData.order_id);
      
      return {
        success: true,
        paymentOrderId: payData.order_id,
        message: '支付成功'
      };
    } catch (error) {
      console.error('支付失败:', error);
      throw error;
    }
  }
}

// 导出单例
const wechatPay = new WeChatPay();

// 挂载到全局对象
if (typeof window !== 'undefined') {
  window.wechatPay = wechatPay;
}

// 如果使用模块化导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = wechatPay;
}
