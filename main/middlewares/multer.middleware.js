import multer from "multer"
import { nanoid } from "nanoid"

const storage = multer.diskStorage({
      destination: function (req, file, cb) {
            cb(null, './public/temp')
      },
      filename: function (req, file, cb) {
            const uniqueSuffix = nanoid()
            cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname.slice(file.originalname.lastIndexOf('.')))

      }
})

export const upload = multer({ storage: storage })