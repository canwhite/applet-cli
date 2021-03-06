#!/usr/bin/env node

//处理用户输入的命令
const program = require('commander');
//下载模板
const download = require('download-git-repo');
//问题交互
const inquirer = require('inquirer');
//node 文件模块
const fs = require('fs');
//填充信息到package.json
const handlebars = require('handlebars');
//动画效果
const ora = require('ora');
//字体加颜色
const chalk = require('chalk');
//显示提示图标
const symbols = require('log-symbols');

const child_process = require('child_process');

const shell = require('shelljs');

console.log(chalk.green('------','初始化开始','------'));

program.version('1.0.0','-V, --version')
.command('init')
.action(()=>{
    //然后我需要先把基座拿出来
    const spinner = ora('Downloading...');
    spinner.start();

    shell.exec('git clone git@github.com:canwhite/qc-wx-main.git', (err, stdout, stderr)=>{
        if(err){
            spinner.fail();
            console.log(symbols.error,chalk.red(err));
           
        }else{
            spinner.succeed();
            console.log(symbols.success,chalk.green("基座下载成功"));

            //然后选择sub基座的名称
            inquirer.prompt([
                {
                    type:'checkbox',
                    name: 'sub',
                    message: 'Choose the subpackage to install',
                    choices: [
                        {
                            name : "qc-wx-sub"
                        },
                        new inquirer.Separator(), // 添加分隔符
                        {
                            name : "xxx"
                        },
                    ]
                }

            ]).then(res=>{

                //res:{ sub: [ 'qc-wx-sub', 'xxx' ] }
                let list = res.sub || [];

                /*
                //进去也没用，下载还是在执行init命令的文件夹，但是我们可以下载后移动
                shell.exec('cd qc-wx-main', (err, stdout, stderr)=>{
                    if(err){
                        console.log(symbols.error,chalk.red(`进入基座失败`)); 

                    }else{
                        console.log(symbols.success,chalk.green(`进入基座成功`)); 
                    }

                });
                */
                let subpackages = []; //刚开始是一个空数组
                let packages = [];//preloadRule里边的小项

                //加载子项目
                list.forEach((item,index)=>{
                    if(item == "qc-wx-sub"){
                        console.log(symbols.success,chalk.green("需要加载子项目" + item));   
                        //1.首先需要下载子项目
                        const spinner = ora('Sub Downloading...');
                        spinner.start();
                    
                        (async ()=>{
                            let data = await downloadSub(item);
                            if(data == "err"){
                                spinner.fail();
                                console.log(symbols.error,chalk.red(`子模块${item}下载失败`)); 
                                return;

                            }
                            if(data == "success"){
                                spinner.succeed();
                                console.log(symbols.success,chalk.green(`子模块${item}下载成功`)); 
                                //2.下载成功之后做一个移动,将subPackage移动到基座里边
                                let move = await moveSub(item);
                                if(move == 'err'){
                                    console.log(symbols.error,chalk.red(`子模块${item}移动失败`)); 
                                    return;
                                }
                                if(move == "success"){
                                    console.log(symbols.success,chalk.green(`子模块${item}移动成功`)); 
                                }

                                //3-1读取子类的config并修改
                                const configfile = `qc-wx-main/${item}/config.js`;
                                const content = fs.readFileSync(configfile).toString();
                                console.log('-----',content);
                                let string = `module.exports = {path:"/${item}"}` 
                                fs.writeFileSync(configfile, string);




                                //3-2.读取子项目中的app.json
                                let read = await readJson(item);
                                if(read == "err"){
                                    console.log(symbols.error,chalk.red(`子模块${item}读取json失败`)); 
                                    return;
                                }else{
                                    console.log(symbols.success,chalk.green(`子模块${item}读取json成功`));
                                     
                                    //4.拼写基座中需要的信息，像上边的规则
                                    subpackages.push(
                                        {
                                            "root":item,
                                            "pages":read.pages
                                        }
                                    )
                                    packages.push(item);

                                    let preloadRule = {
                                        "pages/index/index": {
                                            "network": "all",
                                            "packages":packages
                                        }
                                    }
                                    

                                    //5.读取基座信息，并往基座app.json写入信息

                                    let data = await readAndWriteBaseJson(subpackages,preloadRule);
                                    if(data == "err"){

                                        console.log(symbols.error,chalk.red(`基座json查找失败`)); 
                                    }else{
                                        console.log(symbols.success, chalk.green('基座json修改成功'));

                                    }



                                    let sub = item;
                                    //6.删除子项目
                                    // shell.rm('some_file.txt', 'another_file.txt');
                                    shell.rm(`qc-wx-main/${sub}/app.js`,
                                    `qc-wx-main/${sub}/app.json`,
                                    `qc-wx-main/${sub}/app.wxss`,
                                    `qc-wx-main/${sub}/project.config.json`,
                                    `qc-wx-main/${sub}/readME.md`,
                                    `qc-wx-main/${sub}/sitemap.json`
                                    
                                    )

                                    console.log(chalk.green('------','构建结束','------'));


                                }


                    

                            }

                        })()

                    }
                }) 
            })
        }

    });

});


//下载子模块
let downloadSub = (sub)=>{

    return new Promise((resolve,reject)=>{
        child_process.exec("git clone git@github.com:canwhite/"+  sub + ".git",(err,stdout,stderr)=>{
            if(err){
                resolve("err");

            }else{
                resolve("success");
            }
        });
    })
}

//移动子模块到基座中
let moveSub = (sub)=>{
    return new Promise((resolve,reject)=>{
        child_process.exec(`move ${sub} qc-wx-main` ,(err,stdout,stderr)=>{
            if(err){
                resolve("err");

            }else{
                resolve("success");
            }
        });
    })

}

//读取子项目的package.json，拼凑出我们想要的数据

let readJson = (sub)=>{

    const filename = `qc-wx-main/${sub}/app.json`;

    return new Promise((resolve,reject)=>{
        if (fs.existsSync(filename)) {
            const content = fs.readFileSync(filename).toString();
            //转成json
            let dt = JSON.parse(content);
            resolve(dt);

        }else{
            resolve("err");
        }

    })
};


//读取并修改基座json信息
let readAndWriteBaseJson = (subpackages,preloadRule)=>{
    const baseFileName = `qc-wx-main/app.json`;
    
    return new Promise((resolve,reject)=>{
        if (fs.existsSync(baseFileName)){

            const content = fs.readFileSync(baseFileName).toString();
            //转成json
            let dt = JSON.parse(content);

            //先stringfy转成字符串，再parse转成JSON
            //内容就不会丢失了
            let  subP = JSON.stringify(subpackages);
            let  preL = JSON.stringify(preloadRule);


            dt.subpackages = JSON.parse(subP);
            dt.preloadRule = JSON.parse(preL);

            console.log(chalk.green("-----------------"));
            console.log(dt);
            console.log(chalk.green("-----------------"));

            //最后在整体改成字符串，写入，最后是完整展现的，数据没有丢失
            //这是一个办法呀
            fs.writeFileSync(baseFileName, JSON.stringify(dt,null,2));
            resolve('success');

        }else{
            resolve('err');

        }
    });
}



//最后记得执行下
program.parse(process.argv);