require('dotenv').config();
const puppeteer = require('puppeteer');
const { faker } = require('@faker-js/faker');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const readline = require('readline');
const chalk = require('chalk');

function displayBanner() {
    console.log(chalk.cyan('======================================================================='));
    console.log(chalk.green(`
   ██████╗ ██████╗  █████╗ ██╗   ██╗ █████╗ ████████╗ █████╗ ██████╗ 
  ██╔════╝ ██╔══██╗██╔══██╗██║   ██║██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗
  ██║  ███╗██████╔╝███████║██║   ██║███████║   ██║   ███████║██████╔╝
  ██║   ██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══██║   ██║   ██╔══██║██╔══██╗
  ╚██████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║  ██║   ██║   ██║  ██║██║  ██║
   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝                                                           
    `));
    console.log(chalk.yellow('                           by Masanto'));
    console.log(chalk.cyan('======================================================================='));
    console.log(chalk.gray('Automated Gravatar Account Creation Tool'));
    console.log(chalk.cyan('=======================================================================\n'));
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length/2))
        .toString('hex')
        .slice(0, length);
}

async function createMailcowMailbox() {
    try {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        
        let username = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
        username = username + generateRandomString(3);
        
        const password = process.env.DEFAULT_PASSWORD;
        const domain = process.env.MAILCOW_DOMAIN;
        const email = `${username}@${domain}`;
        
        console.log(chalk.blue(`Creating mailbox: ${chalk.white(email)}`));
        
        const response = await axios({
            method: 'post',
            url: `https://${process.env.MAILCOW_SERVER}/api/v1/add/mailbox`,
            headers: {
                'X-API-Key': process.env.MAILCOW_API_KEY,
                'Content-Type': 'application/json'
            },
            data: {
                local_part: username,
                domain: domain,
                password: password,
                password2: password,
                name: `${firstName} ${lastName}`,
                quota: "0",
                active: "1",
                force_pw_update: "0",
                tls_enforce_in: "0",
                tls_enforce_out: "0"
            }
        });
        
        console.log(chalk.green(`Mailbox created: ${chalk.white(email)}`));
        return { 
            email, 
            password,
            firstName,
            lastName,
            username
        };
    } catch (error) {
        console.error(chalk.red('Error creating mailbox:'), error.response ? error.response.data : error.message);
        throw error;
    }
}

function getEmailVerificationCode(email, password) {
    return new Promise((resolve, reject) => {
        let retryCount = 0;
        const maxRetries = 3;
        const initialWait = 15000;
        
        const attemptRetrieveOTP = () => {
            console.log(chalk.blue(`Checking email for verification code (attempt ${retryCount + 1}/${maxRetries + 1}): ${chalk.white(email)}`));
            
            const imap = new Imap({
                user: email,
                password: password,
                host: process.env.MAILCOW_SERVER,
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });
            
            function openInbox(cb) {
                imap.openBox('INBOX', false, cb);
            }
            
            let connectionTimeout = setTimeout(() => {
                if (imap.state !== 'disconnected') {
                    imap.end();
                }
                retry('Connection timeout');
            }, 30000);
            
            imap.once('ready', function() {
                clearTimeout(connectionTimeout);
                
                openInbox(function(err, box) {
                    if (err) {
                        imap.end();
                        return retry(`Error opening inbox: ${err.message}`);
                    }
                    
                    imap.search(['UNSEEN'], function(err, results) {
                        if (err) {
                            imap.end();
                            return retry(`Search error: ${err.message}`);
                        }
                        
                        if (!results || results.length === 0) {
                            imap.end();
                            return retry('No verification emails found');
                        }
                        
                        processMessages(results);
                    });
                    
                    function processMessages(results) {
                        console.log(chalk.blue(`Found ${results.length} new emails`));
                        
                        const f = imap.fetch(results, {
                            bodies: 'HEADER.FIELDS (SUBJECT FROM)',
                            markSeen: true
                        });
                        
                        let otpFound = false;
                        
                        f.on('message', function(msg, seqno) {
                            msg.on('body', function(stream) {
                                let buffer = '';
                                
                                stream.on('data', function(chunk) {
                                    buffer += chunk.toString('utf8');
                                });
                                
                                stream.once('end', function() {
                                    const header = Imap.parseHeader(buffer);
                                    const subject = header.subject ? header.subject[0] : '';
                                    
                                    if (subject && subject.includes('is your Gravatar code')) {
                                        const otpCode = subject.split(' is your Gravatar code')[0].trim();
                                        
                                        console.log(chalk.green(`Found verification code in subject: ${chalk.white(otpCode)}`));
                                        otpFound = true;
                                        
                                        f.once('end', function() {
                                            imap.end();
                                            resolve(otpCode);
                                        });
                                    }
                                });
                            });
                        });
                        
                        f.once('error', function(err) {
                            console.error(chalk.red('Fetch error:'), err);
                            imap.end();
                            retry(`Fetch error: ${err.message}`);
                        });
                        
                        f.once('end', function() {
                            if (!otpFound) {
                                imap.end();
                                retry('No verification code found in emails');
                            }
                        });
                    }
                });
            });
            
            imap.once('error', function(err) {
                clearTimeout(connectionTimeout);
                console.error(chalk.yellow(`IMAP connection error (attempt ${retryCount + 1}):`, err.message));
                retry(`IMAP error: ${err.message}`);
            });
            
            imap.once('end', function() {
                clearTimeout(connectionTimeout);
            });
            
            imap.connect();
        };
        
        const retry = (reason) => {
            if (retryCount < maxRetries) {
                retryCount++;
                const waitTime = initialWait * retryCount;
                console.log(chalk.yellow(`Retry reason: ${reason}. Waiting ${waitTime/1000} seconds before retry...`));
                setTimeout(attemptRetrieveOTP, waitTime);
            } else {
                console.log(chalk.red(`Failed to retrieve OTP after ${maxRetries + 1} attempts. Reason: ${reason}`));
                reject(new Error(`Could not retrieve OTP after ${maxRetries + 1} attempts: ${reason}`));
            }
        };
        
        setTimeout(attemptRetrieveOTP, initialWait);
    });
}

function saveAccountDetails(accountInfo) {
    const filePath = 'gravatar_accounts.txt';
    const content = `Date: ${new Date().toISOString()}\n` +
                   `Email: ${accountInfo.email}\n` +
                   `Password: ${accountInfo.password}\n` +
                   `Name: ${accountInfo.firstName} ${accountInfo.lastName}\n` +
                   `-----------------------------------\n\n`;
    
    fs.appendFileSync(filePath, content);
    console.log(chalk.green(`Account details saved to ${chalk.white(filePath)}`));
}

function askForVerificationCode() {
    return new Promise((resolve) => {
        const manualCodeRL = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        manualCodeRL.question(chalk.yellow('Please enter the verification code manually: '), (code) => {
            manualCodeRL.close();
            resolve(code);
        });
    });
}

async function createGravatarAccount() {
    let browser;
    
    try {
        const account = await createMailcowMailbox();
        console.log(chalk.green(`Created mailbox: ${chalk.white(account.email)} with password: ${chalk.white(account.password)}`));
        
        browser = await puppeteer.launch({
            headless: false,
            slowMo: 50,
            defaultViewport: { width: 600, height: 700 },
            args: [
                '--window-size=600,700',
                '--window-position=100,50',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto('https://wordpress.com/log-in/link?client_id=1854&redirect_to=https%3A%2F%2Fpublic-api.wordpress.com%2Foauth2%2Fauthorize%3Fclient_id%3D1854%26response_type%3Dcode%26blog_id%3D0%26state%3D08f5f4e685656fd980ab722f39eca20af414496434875fd8a69995e4fe9490fc%26redirect_uri%3Dhttps%253A%252F%252Fgravatar.com%252Fconnect%252F%253Faction%253Drequest_access_token%26gravatar_from%3Dsignup%26from-calypso%3D1&gravatar_from=signup', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        await page.waitForSelector('input[name="usernameOrEmail"]', { visible: true });
        await page.type('input[name="usernameOrEmail"]', account.email, { delay: 20 });
        
        await page.waitForFunction(() => {
            const btn = document.querySelector('button.components-button.is-next-40px-default-size.is-primary');
            return btn && !btn.hasAttribute('disabled');
        });
        
        await page.click('button.components-button.is-next-40px-default-size.is-primary');
        console.log(chalk.blue(`Email submitted: ${chalk.white(account.email)}`));
        
        await page.waitForSelector('input#verification-code', { visible: true, timeout: 60000 });
        console.log(chalk.blue('Verification code input field appeared'));
        
        let verificationCode;
        let maxOtpAttempts = 2;
        let otpAttempt = 0;
        
        while (otpAttempt < maxOtpAttempts) {
            try {
                console.log(chalk.blue(`OTP retrieval attempt ${otpAttempt + 1}/${maxOtpAttempts}...`));
                verificationCode = await getEmailVerificationCode(account.email, account.password);
                
                if (verificationCode) {
                    console.log(chalk.green(`Successfully retrieved verification code: ${chalk.white(verificationCode)}`));
                    break;
                }
            } catch (error) {
                console.log(chalk.yellow(`OTP retrieval attempt ${otpAttempt + 1} failed: ${error.message}`));
                
                if (otpAttempt === maxOtpAttempts - 1) {
                    console.log(chalk.red(`All ${maxOtpAttempts} OTP retrieval attempts failed.`));
                    console.log(chalk.yellow('Falling back to manual OTP entry...'));
                    verificationCode = await askForVerificationCode();
                } else {
                    console.log(chalk.yellow('Waiting before trying again...'));
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }
            }
            
            otpAttempt++;
        }
        
        if (!verificationCode) {
            throw new Error('Could not obtain verification code');
        }
        
        console.log(chalk.blue(`Using verification code: ${chalk.white(verificationCode)}`));
        
        await page.type('input#verification-code', verificationCode, { delay: 20 });
        
        await page.waitForSelector('button.button.form-button.is-primary[type="submit"]', { visible: true });
        
        await page.click('button.button.form-button.is-primary[type="submit"]');
        console.log(chalk.blue('Verification code submitted'));
        
        try {
            await page.waitForNavigation({ timeout: 60000 });
            console.log(chalk.blue(`Navigated to: ${page.url()}`));
            
            if (page.url().includes('gravatar.com/profile/setup')) {
                console.log(chalk.blue('Landed directly on profile setup page'));
                
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                let usernameInput = null;
                const possibleSelectors = [
                    'input[type="text"][maxlength="255"]',
                    'input[maxlength="255"]',
                    'input[type="text"]',
                    'input.components-text-control__input',
                    'input[placeholder*="username"]',
                    'input[placeholder*="Username"]',
                    'input[name*="username"]',
                    'input[id*="username"]'
                ];
                
                console.log(chalk.blue('Looking for username input field...'));
                
                for (const selector of possibleSelectors) {
                    try {
                        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
                        usernameInput = selector;
                        console.log(chalk.green(`Found username input with selector: ${selector}`));
                        break;
                    } catch (error) {
                        console.log(chalk.gray(`Selector "${selector}" not found, trying next...`));
                    }
                }
                
                if (!usernameInput) {
                    console.log(chalk.yellow('Could not find username input. Checking page content...'));
                    
                    const inputs = await page.$$eval('input', inputs => 
                        inputs.map(input => ({
                            type: input.type,
                            placeholder: input.placeholder,
                            maxlength: input.maxLength,
                            name: input.name,
                            id: input.id,
                            className: input.className
                        }))
                    );
                    
                    console.log(chalk.yellow('Available input fields:'), inputs);
                    
                    try {
                        await page.waitForSelector('input[type="text"]:not([style*="display: none"])', { 
                            visible: true, 
                            timeout: 10000 
                        });
                        usernameInput = 'input[type="text"]:not([style*="display: none"])';
                        console.log(chalk.green('Found text input field using generic selector'));
                    } catch (error) {
                        throw new Error('Could not find any suitable username input field');
                    }
                }
                
                await page.type(usernameInput, account.username, { delay: 20 });
                console.log(chalk.blue(`Filled username: ${account.username}`));
                
                const continueSelectors = [
                    'button.components-button.is-primary:not([disabled])',
                    'button.components-button.is-primary',
                    'button[type="submit"]:not([disabled])',
                    'button:contains("Continue")',
                    'button.is-primary'
                ];
                
                let continueButton = null;
                for (const selector of continueSelectors) {
                    try {
                        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
                        continueButton = selector;
                        console.log(chalk.green(`Found continue button with selector: ${selector}`));
                        break;
                    } catch (error) {
                        console.log(chalk.gray(`Continue button selector "${selector}" not found, trying next...`));
                    }
                }
                
                if (continueButton) {
                    await page.waitForFunction((selector) => {
                        const btn = document.querySelector(selector);
                        return btn && !btn.hasAttribute('disabled');
                    }, { timeout: 10000 }, continueButton);
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await page.click(continueButton);
                    console.log(chalk.blue('Clicked Continue button'));
                } else {
                    console.log(chalk.yellow('Could not find Continue button, proceeding anyway...'));
                }
                
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                const laterSelectors = [
                    'button.components-button.is-link',
                    'button:contains("Do it later")',
                    'button:contains("later")',
                    'a:contains("Do it later")',
                    'button.is-link'
                ];
                
                let laterButton = null;
                for (const selector of laterSelectors) {
                    try {
                        await page.waitForSelector(selector, { visible: true, timeout: 10000 });
                        laterButton = selector;
                        console.log(chalk.green(`Found "Do it later" button with selector: ${selector}`));
                        break;
                    } catch (error) {
                        console.log(chalk.gray(`"Do it later" selector "${selector}" not found, trying next...`));
                    }
                }
                
                if (laterButton) {
                    await page.click(laterButton);
                    console.log(chalk.blue('Clicked "Do it later" button'));
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    console.log(chalk.green('Account setup complete - saving details'));
                    saveAccountDetails(account);
                    return { success: true, account };
                } else {
                    console.log(chalk.yellow('Could not find "Do it later" button, but username was filled'));
                    console.log(chalk.yellow('Saving account details as it may be usable'));
                    saveAccountDetails(account);
                    return { success: true, account };
                }
            } 
            else {
                console.log(chalk.yellow(`Different page flow detected: ${page.url()}`));
                console.log(chalk.yellow('Saving account details as it may be usable'));
                saveAccountDetails(account);
                return { success: true, account };
            }
        } catch (error) {
            console.error(chalk.red('Error during account setup:'), error);
            
            try {
                const currentUrl = await page.url();
                console.log(chalk.yellow(`Error occurred at URL: ${currentUrl}`));
                
                if (currentUrl.includes('gravatar.com/profile/setup')) {
                    console.log(chalk.yellow('We are on profile setup page despite the error, attempting to recover...'));
                    console.log(chalk.yellow('Saving account details as it may be usable'));
                    saveAccountDetails(account);
                    return { success: true, account };
                }
            } catch (urlError) {
                // Ignore errors getting the URL
            }
            
            return { success: false, error };
        }
    } catch (error) {
        console.error(chalk.red('Automation error:'), error);
        return { success: false, error };
    } finally {
        if (browser) {
            console.log(chalk.gray('Closing browser in 2 seconds...'));
            await new Promise(resolve => setTimeout(resolve, 2000));
            await browser.close();
        }
    }
}

async function createMultipleAccounts(count) {
    console.log(chalk.magenta(`\nStarting batch creation of ${count} Gravatar accounts...\n`));
    
    const results = {
        total: count,
        successful: 0,
        failed: 0,
        accounts: []
    };
    
    for (let i = 0; i < count; i++) {
        console.log(chalk.cyan(`\n===== Creating account ${i + 1} of ${count} =====\n`));
        
        const result = await createGravatarAccount();
        
        if (result.success) {
            results.successful++;
            results.accounts.push(result.account);
            console.log(chalk.green(`Account ${i + 1} created successfully`));
        } else {
            results.failed++;
            console.log(chalk.red(`Account ${i + 1} failed to create`));
        }
    }
    
    console.log(chalk.cyan('\n===== Batch Creation Summary =====\n'));
    console.log(chalk.green(`Successful: ${results.successful}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.cyan('=================================\n'));
}

(async () => {
    displayBanner();
    
    rl.question(chalk.yellow('Enter the number of Gravatar accounts to create: '), async (input) => {
        const count = parseInt(input);
        
        if (isNaN(count) || count <= 0) {
            console.log(chalk.red('Invalid number of accounts. Please enter a positive integer.'));
            rl.close();
            return;
        }
        
        await createMultipleAccounts(count);
        
        rl.close();
    });
})();
