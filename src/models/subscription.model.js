import mongoose, {Schema} from "mongoose"

const subscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Type.ObjectId, // one who is subscribing
        ref: "User",
    },
    channel:{
        type: Schema.Type.ObjectId, // one to whom 'subscriber' is subscribing.
        ref: "User",
    }
}, {timestamps: true})
 

export const Subscription = mongoose.model("Subscription", subscriptionSchema)