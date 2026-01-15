/**
 * 通用时间选择器模块
 * 提供可复用的时间picker功能
 * 
 * 使用方法:
 * const picker = new TimePicker({
 *   sheetId: 'pickerSheet',
 *   onConfirm: (dateTime) => { console.log(dateTime); }
 * });
 * picker.open();
 */

class TimePicker {
  constructor(options = {}) {
    this.options = options;
    this.sheetId = options.sheetId || 'pickerSheet';
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});
    
    // 初始化时间变量
    this.selectedYear = new Date().getFullYear();
    this.selectedMonth = new Date().getMonth() + 1;
    this.selectedDay = new Date().getDate();
    this.selectedHour = new Date().getHours();
    this.selectedMinute = new Date().getMinutes();
    this.selectedSecond = new Date().getSeconds();
    
    this.ITEM_HEIGHT = 40;
    this.eventsBound = false;
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.bindBaseEvents();
  }

  cacheElements() {
    this.sheet = document.getElementById(this.sheetId);
    this.colYear = document.getElementById(`${this.sheetId}_colYear`);
    this.colMonth = document.getElementById(`${this.sheetId}_colMonth`);
    this.colDay = document.getElementById(`${this.sheetId}_colDay`);
    this.colHour = document.getElementById(`${this.sheetId}_colHour`);
    this.colMinute = document.getElementById(`${this.sheetId}_colMinute`);
    this.colSecond = document.getElementById(`${this.sheetId}_colSecond`);
  }

  bindBaseEvents() {
    if (!this.sheet) return;
    
    const cancel = this.sheet.querySelector('[data-picker-cancel]');
    const confirm = this.sheet.querySelector('[data-picker-confirm]');
    const btnNow = this.sheet.querySelector('[data-picker-now]');
    const btnAfterHour = this.sheet.querySelector('[data-picker-after-hour]');
    const btnTomorrow = this.sheet.querySelector('[data-picker-tomorrow]');
    
    if (cancel) cancel.addEventListener('click', () => this.cancel());
    if (confirm) confirm.addEventListener('click', () => this.confirm());
    if (btnNow) btnNow.addEventListener('click', () => this.setNow());
    if (btnAfterHour) btnAfterHour.addEventListener('click', () => this.setAfterHour());
    if (btnTomorrow) btnTomorrow.addEventListener('click', () => this.setTomorrow());
    
    if (this.sheet) {
      this.sheet.addEventListener('click', (e) => {
        if (e.target === this.sheet) this.cancel();
      });
    }
  }

  open() {
    if (!this.sheet) return;
    
    // 每次打开都初始化为当前时间
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedDay = now.getDate();
    this.selectedHour = now.getHours();
    this.selectedMinute = now.getMinutes();
    this.selectedSecond = now.getSeconds();
    
    this.sheet.style.display = 'flex';
    if (typeof disableBodyScroll === 'function') {
      disableBodyScroll();
    }
    this.renderAllColumns();
    
    setTimeout(() => this.bindColumnEvents(), 200);
  }

  close() {
    if (this.sheet) {
      this.sheet.style.display = 'none';
      if (typeof enableBodyScroll === 'function') {
        enableBodyScroll();
      }
    }
  }

  bindColumnEvents() {
    if (this.eventsBound) return;
    
    this.setupColumnPicker(this.colYear, (val) => {
      this.selectedYear = val;
      const monthList = this.getListByType('month');
      if (!monthList.includes(this.selectedMonth)) {
        this.selectedMonth = monthList[0];
      }
      this.renderColumn(this.colMonth, monthList, this.selectedMonth, true);
      this.renderColumn(this.colDay, this.getListByType('day'), this.selectedDay, true);
      this.renderColumn(this.colHour, this.getListByType('hour'), this.selectedHour, true);
      this.renderColumn(this.colMinute, this.getListByType('minute'), this.selectedMinute, true);
      this.renderColumn(this.colSecond, this.getListByType('second'), this.selectedSecond, true);
    });
    
    this.setupColumnPicker(this.colMonth, (val) => {
      this.selectedMonth = val;
      const dayList = this.getListByType('day');
      if (!dayList.includes(this.selectedDay)) {
        this.selectedDay = dayList[0];
      }
      this.renderColumn(this.colDay, dayList, this.selectedDay, true);
      this.renderColumn(this.colHour, this.getListByType('hour'), this.selectedHour, true);
      this.renderColumn(this.colMinute, this.getListByType('minute'), this.selectedMinute, true);
      this.renderColumn(this.colSecond, this.getListByType('second'), this.selectedSecond, true);
    });
    
    this.setupColumnPicker(this.colDay, (val) => {
      this.selectedDay = val;
      const hourList = this.getListByType('hour');
      if (!hourList.includes(this.selectedHour)) {
        this.selectedHour = hourList[0];
      }
      this.renderColumn(this.colHour, hourList, this.selectedHour, true);
      this.renderColumn(this.colMinute, this.getListByType('minute'), this.selectedMinute, true);
      this.renderColumn(this.colSecond, this.getListByType('second'), this.selectedSecond, true);
    });
    
    this.setupColumnPicker(this.colHour, (val) => {
      this.selectedHour = val;
      const minuteList = this.getListByType('minute');
      if (!minuteList.includes(this.selectedMinute)) {
        this.selectedMinute = minuteList[0];
      }
      this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
      this.renderColumn(this.colSecond, this.getListByType('second'), this.selectedSecond, true);
      
      // 当小时达到23时，自动进位到天
      if (val === 23) {
        this.autoCarry('hour');
      }
    });
    
    this.setupColumnPicker(this.colMinute, (val) => {
      this.selectedMinute = val;
      const secondList = this.getListByType('second');
      if (!secondList.includes(this.selectedSecond)) {
        this.selectedSecond = secondList[0];
      }
      this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
      // 当分钟达到最大值时，自动进位到小时
      if (val === 59) {
        this.autoCarry('minute');
      }
    });
    
    this.setupColumnPicker(this.colSecond, (val) => {
      this.selectedSecond = val;
      // 当秒达到最大值时，自动进位到分钟
      if (val === 59) {
        this.autoCarry('second');
      }
    });
    
    this.eventsBound = true;
  }

  setupColumnPicker(el, onValueChange) {
    if (!el) return;
    
    let isScrolling;
    
    el.addEventListener('scroll', () => {
      clearTimeout(isScrolling);
      isScrolling = setTimeout(() => {
        const padding = 2;
        const indicatorPosition = 80;
        const itemAtIndicator = Math.round((el.scrollTop + indicatorPosition) / this.ITEM_HEIGHT);
        
        const items = el.querySelectorAll('[data-value]');
        const dataIndex = itemAtIndicator - padding;
        const validIndex = Math.max(0, Math.min(dataIndex, items.length - 1));
        
        if (items[validIndex]) {
          const value = parseInt(items[validIndex].dataset.value);
          if (!isNaN(value)) {
            onValueChange(value);
          }
        }
        
        const snapScrollTop = (dataIndex + padding) * this.ITEM_HEIGHT - indicatorPosition;
        el.scrollTo({
          top: snapScrollTop,
          behavior: 'smooth'
        });
      }, 100);
    }, false);
  }

  getListByType(type) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    switch(type) {
      case 'year':
        return [currentYear, currentYear + 1, currentYear + 2];
      
      case 'month': {
        if (this.selectedYear > currentYear) {
          return Array.from({length: 12}, (_, i) => i + 1);
        }
        return Array.from({length: 12 - currentMonth + 1}, (_, i) => currentMonth + i);
      }
      
      case 'day': {
        const maxDays = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
        if (this.selectedYear > currentYear || (this.selectedYear === currentYear && this.selectedMonth > currentMonth)) {
          return Array.from({length: maxDays}, (_, i) => i + 1);
        }
        const isCurrentYearMonth = this.selectedYear === currentYear && this.selectedMonth === currentMonth;
        const startDay = isCurrentYearMonth ? currentDay : 1;
        return Array.from({length: maxDays - startDay + 1}, (_, i) => startDay + i);
      }
      
      case 'hour': {
        if (this.selectedYear > currentYear || 
            (this.selectedYear === currentYear && this.selectedMonth > currentMonth) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay > currentDay)) {
          return Array.from({length: 24}, (_, i) => i);
        }
        const isToday = this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay === currentDay;
        const startHour = isToday ? currentHour : 0;
        return Array.from({length: 24 - startHour}, (_, i) => startHour + i);
      }
      
      case 'minute': {
        if (this.selectedYear > currentYear || 
            (this.selectedYear === currentYear && this.selectedMonth > currentMonth) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay > currentDay) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay === currentDay && this.selectedHour > currentHour)) {
          return Array.from({length: 60}, (_, i) => i);
        }
        const isThisHour = this.selectedYear === currentYear && this.selectedMonth === currentMonth && 
                          this.selectedDay === currentDay && this.selectedHour === currentHour;
        const startMinute = isThisHour ? currentMinute : 0;
        return Array.from({length: 60 - startMinute}, (_, i) => startMinute + i);
      }
      
      case 'second': {
        if (this.selectedYear > currentYear || 
            (this.selectedYear === currentYear && this.selectedMonth > currentMonth) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay > currentDay) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay === currentDay && this.selectedHour > currentHour) ||
            (this.selectedYear === currentYear && this.selectedMonth === currentMonth && this.selectedDay === currentDay && this.selectedHour === currentHour && this.selectedMinute > currentMinute)) {
          return Array.from({length: 60}, (_, i) => i);
        }
        const isThisMinute = this.selectedYear === currentYear && this.selectedMonth === currentMonth && 
                            this.selectedDay === currentDay && this.selectedHour === currentHour && 
                            this.selectedMinute === currentMinute;
        const startSecond = isThisMinute ? currentSecond : 0;
        return Array.from({length: 60 - startSecond}, (_, i) => startSecond + i);
      }
      
      default:
        return [];
    }
  }

  renderAllColumns() {
    const yearList = this.getListByType('year');
    const monthList = this.getListByType('month');
    const dayList = this.getListByType('day');
    const hourList = this.getListByType('hour');
    const minuteList = this.getListByType('minute');
    const secondList = this.getListByType('second');
    
    this.renderColumn(this.colYear, yearList, this.selectedYear, false);
    this.renderColumn(this.colMonth, monthList, this.selectedMonth, true);
    this.renderColumn(this.colDay, dayList, this.selectedDay, true);
    this.renderColumn(this.colHour, hourList, this.selectedHour, true);
    this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
    this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
  }

  renderColumn(el, list, currentValue, pad2 = false) {
    if (!el) return;
    
    const padding = 2;
    let html = '';
    
    // 根据 sheetId 确定类名后缀
    const classSuffix = this.sheetId === 'pickerSheet' ? '' : '-human';
    const itemClass = `picker-item${classSuffix}`;
    const emptyClass = `picker-item-empty${classSuffix}`;
    
    for (let i = 0; i < padding; i++) {
      html += `<div class="${itemClass} ${emptyClass}"></div>`;
    }
    
    html += list.map((v, idx) => {
      const display = pad2 ? String(v).padStart(2, '0') : v;
      return `<div class="${itemClass}" data-value="${v}" data-index="${idx}">${display}</div>`;
    }).join('');
    
    for (let i = 0; i < padding; i++) {
      html += `<div class="${itemClass} ${emptyClass}"></div>`;
    }
    
    el.innerHTML = html;
    
    const index = list.indexOf(currentValue);
    
    if (index >= 0) {
      const indicatorPosition = 80;
      const scrollPosition = (index + padding) * this.ITEM_HEIGHT - indicatorPosition;
      el.scrollTop = scrollPosition;
      
      setTimeout(() => {
        el.scrollTop = scrollPosition;
      }, 50);
    } else {
      el.scrollTop = 0;
    }
  }

  getFormattedDateTime() {
    const M = String(this.selectedMonth).padStart(2, '0');
    const D = String(this.selectedDay).padStart(2, '0');
    const h = String(this.selectedHour).padStart(2, '0');
    const m = String(this.selectedMinute).padStart(2, '0');
    const s = String(this.selectedSecond).padStart(2, '0');
    return `${this.selectedYear}-${M}-${D} ${h}:${m}:${s}`;
  }

  // 自动进位处理：当达到最大值时，进位到下一个单位
  autoCarry(unit) {
    switch (unit) {
      case 'second':
        this.selectedSecond = 0;
        this.selectedMinute += 1;
        if (this.selectedMinute > 59) {
          this.autoCarry('minute');
        } else {
          // 重新渲染分钟列，并更新秒列
          const minuteList = this.getListByType('minute');
          const secondList = this.getListByType('second');
          this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
          this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
        }
        break;
        
      case 'minute':
        this.selectedMinute = 0;
        this.selectedHour += 1;
        if (this.selectedHour > 23) {
          this.autoCarry('hour');
        } else {
          // 重新渲染小时列，并更新分钟、秒列
          const hourList = this.getListByType('hour');
          const minuteList = this.getListByType('minute');
          const secondList = this.getListByType('second');
          this.renderColumn(this.colHour, hourList, this.selectedHour, true);
          this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
          this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
        }
        break;
        
      case 'hour':
        this.selectedHour = 0;
        this.selectedDay += 1;
        const maxDays = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
        if (this.selectedDay > maxDays) {
          this.autoCarry('day');
        } else {
          // 重新渲染所有时间列
          const dayList = this.getListByType('day');
          const hourList = this.getListByType('hour');
          const minuteList = this.getListByType('minute');
          const secondList = this.getListByType('second');
          this.renderColumn(this.colDay, dayList, this.selectedDay, true);
          this.renderColumn(this.colHour, hourList, this.selectedHour, true);
          this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
          this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
        }
        break;
        
      case 'day':
        this.selectedDay = 1;
        this.selectedMonth += 1;
        if (this.selectedMonth > 12) {
          this.autoCarry('month');
        } else {
          // 重新渲染月份及以后的列
          const monthList = this.getListByType('month');
          const dayList = this.getListByType('day');
          const hourList = this.getListByType('hour');
          const minuteList = this.getListByType('minute');
          const secondList = this.getListByType('second');
          this.renderColumn(this.colMonth, monthList, this.selectedMonth, true);
          this.renderColumn(this.colDay, dayList, this.selectedDay, true);
          this.renderColumn(this.colHour, hourList, this.selectedHour, true);
          this.renderColumn(this.colMinute, minuteList, this.selectedMinute, true);
          this.renderColumn(this.colSecond, secondList, this.selectedSecond, true);
        }
        break;
        
      case 'month':
        this.selectedMonth = 1;
        this.selectedYear += 1;
        // 重新渲染所有列
        this.renderAllColumns();
        break;
    }
  }

  confirm() {
    const dateTime = this.getFormattedDateTime();
    this.onConfirm(dateTime);
    this.close();
  }

  cancel() {
    this.onCancel();
    this.close();
  }

  setNow() {
    this.onConfirm('');
    this.close();
  }

  setAfterHour() {
    const t = new Date(Date.now() + 3600 * 1000);
    const dateTime = this.formatDate(t);
    this.onConfirm(dateTime);
    this.close();
  }

  setTomorrow() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const dateTime = this.formatDate(t);
    this.onConfirm(dateTime);
    this.close();
  }

  formatDate(d) {
    const y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${M}-${D} ${h}:${m}:${s}`;
  }
}

// ES 模块导出
export default TimePicker;
