var express = require('express')
var ejs = require('ejs')
var bodyParser = require('body-parser')
var mysql = require('mysql')
var session = require('express-session')
var cookieParser = require('cookie-parser');
var jwt = require('jsonwebtoken');


var app = express()
var secret = 'pa106'
app.use(express.static('public'))
app.set('view engine', 'ejs')
app.set('views', './views/pages');


const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project"
})

app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(session({
    secret: "pa106",
    resave: false,
    saveUninitialized: false,
    key: 'usercookie',
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 ngày
    }

}))


const authenticateToken = (req, res, next) => {
    if (req.session.username) {
        return next();
    }

    const token = req.cookies['usercookie'];
    if (!token) return res.redirect('/');

    jwt.verify(token, secret, (err, user) => {
        if (err) return res.sendStatus(403);
        req.session.username = user.username;
        next();
    });
};
function isProductInCart(cart, id) {
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id == id) {
            return true
        }
    }
    return false
}
function calculateTotal(cart, req) {
    var total = 0
    for (let i = 0; i < cart.length; i++) {
        total = total + (cart[i].price * cart[i].quantity)
    }
    req.session.total = total
    return total
}
app.get('/', function (req, res) {
    if (req.session.loggedin) {
        res.redirect('/home')
    } else {
        res.render('login', { message: '' })
    }
});
app.post('/buy', function (req, res) {
    var total = req.body.total
    con.query('Select * from account where UserName = ?', [req.session.user.username], function (err, result) {
        if (err) throw err;
        var user = result[0]
        if (user.Money < total) {
            res.send("Tai khoan cua ban khong du tien vui long nap them")
        } else {
            var Money = user.Money - total;
            con.query('UPDATE account SET Money = ? WHERE UserName = ?', [Money, req.session.user.username])
            res.redirect('/home')
        }
    })
})
app.post('/update-quantity', function (req, res) {
    var id = req.body.id
    var quantity = req.body.quantity
    var cart = req.session.cart

    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id == id) {
            cart[i].quantity = quantity;  // Cập nhật số lượng mới
            break;
        }
    }
    calculateTotal(cart, req);
    res.redirect('/cart')
})
app.post('/remove', function (req, res) {
    var id = req.body.id
    var cart = req.session.cart

    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id == id) {
            cart.splice(i, 1)
            break;
        }
    }
    calculateTotal(cart, req);
    res.redirect('/cart')
})
app.post('/changepassword', function (req, res) {
    const { username, oldpassword, newpassword, cfpassword } = req.body
    if (username && oldpassword && newpassword && cfpassword) {
        con.query('SELECT * FROM account WHERE UserName = ? AND PassWord = ? AND role = 0', [username, oldpassword], function (error, results) {
            if (error) throw error;
            if (results.length > 0) {
                if (newpassword === cfpassword) {
                    con.query('UPDATE account SET PassWord = ? WHERE UserName = ?', [newpassword, username])
                    res.send("Mat khau cua ban da duoc thay doi")
                }
                else {
                    res.send("Kiem tra lai xac nhan mat khau")
                }
            }
            else {
                res.send("Tai khoan hoac mat khau cu khong dung")
            }
        })
    }
})
app.post('/login', function (req, res) {
    const { username, password, rememberMe } = req.body
    let query = 'SELECT * FROM account WHERE UserName = ? AND PassWord = ?'
    if (username && password) {
        con.query(query, [username, password], function (error, results) {
            if (error) throw error;
            if (results.length > 0) {
                const user = results[0]
                req.session.user = {
                    id: user.idaccount,
                    username: user.UserName,
                    role: user.Role
                };
                if (rememberMe) {
                    const token = jwt.sign({ username: username }, secret, { expiresIn: '7d' });
                    con.query('UPDATE account SET RememberMeCookie = ?, CookieExpiredDate = ? WHERE UserName = ?', [token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), username], (err, results) => {
                        if (err) throw err;
                    });
                    res.cookie('usercookie', token, { maxAge: 7 * 24 * 60 * 60 * 1000 });
                }

                req.session.loggedin = true;
                res.redirect('/home');
            } else {
                // res.send('Incorrect Username or Password!');
                res.render('login', { message: 'Ten dang nhap hoac mat khau khong chinh xac!' })
            }
        });
    } else {
        res.send('Please enter Username and Password!');
    }
});
app.post('/registers', function (req, res) {
    var { username, password, cfpassword, phonenumber, email } = req.body
    if (password !== cfpassword) {
        res.redirect('/register?error=Mat khau nhap lai khong trung khop')
    } else {
        con.query('INSERT INTO account (UserName, PassWord, PhoneNumber, Email) VALUES (?, ?, ?, ?)', [username, password, phonenumber, email], (err, results) => {
            if (err) throw err;
            res.redirect('/')
        });
    }
})
app.post('/personal_profile', function (req, res) {
    var { username, phonenumber, email } = req.body
    con.query('UPDATE account SET PhoneNumber = ? Email =  WHERE UserName = ?', [phonenumber, email, username], (err, results) => {
        if (err) throw err;

        res.redirect('/')
    })
})
app.post('/cart', function (req, res) {
    var { id, name, price, sale_price, quantity, image } = req.body
    var product = { id: id, name: name, price: price, sale_price: sale_price, quantity: quantity, image: image }
    if (req.session.cart) {
        var cart = req.session.cart
        var ProductInCart = isProductInCart(cart, id)
        if (!isProductInCart(cart, id)) {
            cart.push(product)
        } else {
            ProductInCart.quantity += quantity
        }
    } else {
        req.session.cart = [product]
        var cart = req.session.cart
    }
    calculateTotal(cart, req)
    res.redirect('/home')
})
app.get('/home', function (req, res) {
    if (req.session.loggedin) {
        con.query("SELECT * FROM product", (err, result) => {
            if (err) throw err
            res.render('index', { result: result, role: req.session.user.role })
        })
    } else {
        res.send('Please login to view this page!');
    }
});
app.get('/about', function (req, res) {
    if (req.session.loggedin) {
        res.render('about')
    } else {
        res.render('login', { message: '' })
    }
});
app.get('/brand', function (req, res) {
    if (req.session.loggedin) {
        res.render('brand')
    } else {
        res.render('login', { message: '' })
    }
});
app.get('/login', function (req, res) {
    if (req.session.loggedin) {
        res.redirect('/home')
    } else {
        res.render('login', { message: '' })
    }
});
app.get('/register', function (req, res) {
    const errorMessage = req.query.error;
    res.render('register', { error: errorMessage })
});
app.get('/contact', function (req, res) {
    if (req.session.loggedin) {
        res.render('contact')
    } else {
        res.render('login')
    }
});
app.get('/personal_profile', function (req, res) {
    if (req.session.loggedin) {
        con.query("SELECT * FROM account where UserName = ?", [req.session.user.username], (err, result) => {
            if (err) throw err
            res.render('personal_profile', { result: result })
        })
    }
});
app.get('/changepassword', function (req, res) {
    if (req.session.loggedin || authenticateToken) {
        con.query("SELECT * FROM account", (err, result) => {
            if (err) throw err
            res.render('changepassword')
        })
    }
});
app.get('/cart', function (req, res) {
    if (req.session.loggedin) {
        var cart = req.session.cart || []
        var total = req.session.total || 0
        res.render('cart', { cart: cart, total: total })
    }
});
app.post('/logout', (req, res) => {
    con.query('UPDATE account SET RememberMeCookie = 0, CookieExpiredDate = NULL WHERE UserName = ?', [req.session.user.username], (err, results) => {
        if (err) throw err;
    });
    res.clearCookie('usercookie');
    req.session.destroy();
    res.redirect('/');
});
app.listen(2904);
