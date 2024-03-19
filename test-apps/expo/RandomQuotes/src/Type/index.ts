export interface User {
  address: string | null
  avatar: string | null
  thumbnail_avatar?: string | null
  email: string | null
  email_me: boolean
  email_popular_books: boolean
  email_administrative_messages: boolean
  email_promotional_messages: boolean
  email_rate_book_reminders: boolean
  email_newsletter: boolean
  email_club_information: boolean
  get_member_club_admin_ids: number[]
  get_member_club_ids: number[]
  id: number
  is_active: boolean
  name: string | null
  phone: string | null
  pronouns?: string
  forum_username: string
  timezone: string
  get_referral_url: string
  club?: number
  share_info_with_club?: boolean
  num_of_showed_public_reviews_modal: number
  approved_sharing_book_reviews_publicly: boolean | null
  get_requested_club_ids?: number[]
}
