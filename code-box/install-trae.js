const { exec } = require('child_process');
const path = require('path');

console.log('正在安装 trae-cli...');

const child = exec('npm install -g trae-cli', {
  maxBuffer: 1024 * 1024,
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✓ trae-cli 安装成功');
    console.log('现在请验证: trae --version');
  } else {
    console.log('\n✗ 安装失败，退出码:', code);
  }
  process.exit(code);
});