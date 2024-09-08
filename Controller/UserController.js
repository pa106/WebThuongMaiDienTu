const UserService = require("../services/UserService")
const createUser = async (req, res) => {
    try {
        console.log(req.body)
        const { idUser, UserName, Password, ConfirmPassword } = req.body
        const res = await UserService.createUser()
        if (!idUser || !UserName || !Password || !ConfirmPassword) {
            return res.status(200).json({
                status: 'ERR',
                message: 'The input is required'
            })
        } else if (Password !== ConfirmPassword) {
            return res.status(200).json({
                status: 'ERR',
                message: 'The Password need to equal ConfirmPassword'
            })

        }
    } catch (error) {
        res.status(404).json({
            message: error
        })
    }
}
module.exports = {
    createUser
}