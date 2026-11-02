/**
 * src/questions.js - Default Questions Bank & Google Sheets CSV Importer
 */

const DEFAULT_QUESTIONS = [
  // หมวดอาหาร & เครื่องดื่ม
  { questionId: "q_1", question: "ถ้าต้องกินอาหารเมนูเดียวตลอด 1 เดือนเต็ม คุณจะเลือกอะไร?", optionA: "กะเพราไข่ดาว", optionB: "ส้มตำไก่ย่าง", optionC: "ชาบูหมูกระทะ", optionD: "ก๋วยเตี๋ยวน้ำตก", category: "Food" },
  { questionId: "q_2", question: "เครื่องดื่มแก้วโปรดช่วงบ่ายที่ขาดไม่ได้?", optionA: "ชาไทยเย็น", optionB: "ชานมไข่มุก", optionC: "อเมริกาโน่เย็น", optionD: "มัทฉะลาเต้", category: "Drink" },
  { questionId: "q_3", question: "ของหวานปิดท้ายมื้ออาหารที่ดีที่สุด?", optionA: "ไอศกรีม", optionB: "บิงซู", optionC: "บัวลอยนมสด", optionD: "เค้กช็อกโกแลต", category: "Food" },
  { questionId: "q_4", question: "ถ้าสั่งกะเพรา ไข่ดาวต้องเป็นแบบไหน?", optionA: "ไข่ดาวกรอบไข่แดงไม่สุก", optionB: "ไข่ดาวนิ่มไข่แดงไม่สุก", optionC: "ไข่ดาวสุกสนิท 100%", optionD: "เปลี่ยนเป็นไข่เจียว", category: "Food" },
  { questionId: "q_5", question: "ผลไม้ไทยที่คุณชอบกินมากที่สุด?", optionA: "ทุเรียน", optionB: "มะม่วงน้ำดอกไม้", optionC: "มังคุด", optionD: "แตงโม", category: "Food" },
  { questionId: "q_6", question: "ของทอดสตรีทฟู้ดที่เห็นแล้วต้องแวะซื้อ?", optionA: "ไก่ทอดหาดใหญ่", optionB: "ลูกชิ้นทอด", optionC: "กล้วยทอด", optionD: "หมูทอดเจียงฮาย", category: "Food" },
  { questionId: "q_7", question: "เส้นก๋วยเตี๋ยวที่คุณมักจะสั่งบ่อยที่สุด?", optionA: "เส้นเล็ก", optionB: "เส้นใหญ่", optionC: "บะหมี่เหลือง", optionD: "วุ้นเส้น", category: "Food" },
  { questionId: "q_8", question: "ถ้าต้องเลือกกินฟาสต์ฟู้ดเจ้านี้ไปตลอดชีวิต?", optionA: "McDonald's", optionB: "KFC", optionC: "Burger King", optionD: "Texas Chicken", category: "Food" },
  { questionId: "q_9", question: "ระดับความหวานของชานมไข่มุกที่คุณสั่งประจำ?", optionA: "หวานปกติ 100%", optionB: "หวานน้อย 50%", optionC: "หวานน้อยมาก 25%", optionD: "ไม่หวานเลย 0%", category: "Drink" },
  { questionId: "q_10", question: "น้ำซุปชาบูที่โต๊ะคุณต้องมีเสมอ?", optionA: "น้ำดำสุกี้ยากี้", optionB: "ต้มยำน้ำข้น", optionC: "ซุปกระดูกหมูทงคัตสึ", optionD: "ซุปหม่าล่าลิ้นชา", category: "Food" },

  // หมวดไลฟ์สไตล์ & นิสัย
  { questionId: "q_11", question: "ถ้าได้เงินฟรี 1 ล้านบาท สิ่งแรกที่จะทำคือ?", optionA: "ซื้อรถในฝัน", optionB: "เก็บฝาก/ลงทุนหุ้น", optionC: "เที่ยวรอบโลก", optionD: "โปะหนี้/ให้ครอบครัว", category: "Lifestyle" },
  { questionId: "q_12", question: "ช่วงเวลาที่คุณรู้สึกโฟกัสและมีสมาธิทำงาน/อ่านหนังสือที่สุด?", optionA: "เช้าตรู่ 06:00 - 09:00", optionB: "บ่าย 13:00 - 16:00", optionC: "หัวค่ำ 19:00 - 22:00", optionD: "ดึกสงัด เที่ยงคืนขึ้นไป", category: "Lifestyle" },
  { questionId: "q_13", question: "วิธีคลายเครียดที่ได้ผลเร็วที่สุดสำหรับคุณ?", optionA: "นอนหลับยาวๆ", optionB: "กินของอร่อยตามใจปาก", optionC: "เล่นเกมทั้งวัน", optionD: "ออกไปช้อปปิ้ง", category: "Lifestyle" },
  { questionId: "q_14", question: "ถ้ามีวันหยุดยาว 3 วันโดยไม่ต้องทำงานหรือเรียน?", optionA: "นอนพักอยู่บ้านไม่ออกไปไหน", optionB: "ขับรถเที่ยวต่างจังหวัด", optionC: "นัดตระเวนกินกับเพื่อน", optionD: "ไปคาเฟ่ถ่ายรูปทำคอนเทนต์", category: "Lifestyle" },
  { questionId: "q_15", question: "เสียงนาฬิกาปลุกดังตอนเช้า พฤติกรรมแรกของคุณคือ?", optionA: "ลุกทันทีไม่ลีลา", optionB: "กดเลื่อน (Snooze) 5 นาที", optionC: "ปิดทิ้งแล้วหลับต่อ", optionD: "หยิบมือถือมาไถโซเชียล", category: "Habit" },
  { questionId: "q_16", question: "ถ้าเลือกเลี้ยงสัตว์ได้เพียง 1 ชนิด?", optionA: "สุนัขแสนรู้", optionB: "แมวอินดี้", optionC: "กระต่ายน่ารัก", optionD: "ปลาสวยงาม", category: "Lifestyle" },
  { questionId: "q_17", question: "แอปพลิเคชันแรกที่คุณมักจะเปิดตอนตื่นนอน?", optionA: "LINE", optionB: "Instagram", optionC: "TikTok", optionD: "Facebook / X", category: "Tech" },
  { questionId: "q_18", question: "ประเภทคอนโด/บ้านในฝันที่คุณอยากเป็นเจ้าของ?", optionA: "บ้านเดี่ยวชานเมืองสงบๆ", optionB: "คอนโดหรูใจกลางเมือง", optionC: "พูลวิลล่าริมทะเล", optionD: "บ้านสวนสไตล์ธรรมชาติ", category: "Lifestyle" },
  { questionId: "q_19", question: "ถ้าสภาพอากาศร้อนจัด คุณจะแก้ปัญหาด้วยวิธีไหน?", optionA: "เปิดแอร์ฉ่ำๆ อยู่แต่ในห้อง", optionB: "กินไอติม/น้ำแข็งใส", optionC: "อาบน้ำวันละ 3 รอบ", optionD: "ไปเดินเล่นตากแอร์ที่ห้าง", category: "Lifestyle" },
  { questionId: "q_20", question: "คุณชอบดูสื่อบันเทิงรูปแบบไหนที่สุดในวันว่าง?", optionA: "ซีรีส์/ภาพยนตร์สตรีมมิง", optionB: "คลิปสั้น Reels / TikTok", optionC: "ไลฟ์สตรีมเกม / คอนเทนต์", optionD: "ฟังพอดแคสต์ / เพลงยาวๆ", category: "Entertainment" },

  // หมวดโซเชียล & เทคโนโลยี
  { questionId: "q_21", question: "แพลตฟอร์มโซเชียลที่ถ้าโดนลบไป คุณจะลงแดงที่สุด?", optionA: "TikTok", optionB: "Instagram", optionC: "YouTube", optionD: "X (Twitter)", category: "Tech" },
  { questionId: "q_22", question: "ระบบปฏิบัติการสมาร์ตโฟนที่คุณเลือกใช้?", optionA: "iOS (iPhone)", optionB: "Android ทรงเรือธง", optionC: "Android คุ้มค่าเน้นสเปก", optionD: "ใช้อะไรก็ได้ไม่เกี่ยง", category: "Tech" },
  { questionId: "q_23", question: "สไตล์การพิมพ์แชตของคุณเป็นแบบไหนมากที่สุด?", optionA: "ส่งข้อความยาวทีเดียวจบ", optionB: "ส่งทีละประโยค รัวหลายบรรทัด", optionC: "ส่งแต่สติกเกอร์ / อิโมจิ", optionD: "ส่งเป็นคลิปเสียง", category: "Social" },
  { questionId: "q_24", question: "ถ้าแบตเตอรี่มือถือเหลือ 10% แต่ลืมพกสายชาร์จ คุณจะทำอย่างไร?", optionA: "เปิดโหมดประหยัดพลังงานสุดขีด", optionB: "หาซื้อสายชาร์จใหม่ทันที", optionC: "เดินขอยืมคนรอบตัว", optionD: "ปล่อยดับ ไม่ซีเรียส", category: "Tech" },
  { questionId: "q_25", question: "แนวเกมที่คุณมักจะเล่นบ่อยที่สุด?", optionA: "MOBA (RoV / LoL)", optionB: "Shooting (Valorant / PUBG)", optionC: "Open World / RPG", optionD: "Puzzle / แคชชวลชิลๆ", category: "Gaming" },

  // หมวดการท่องเที่ยว & เดินทาง
  { questionId: "q_26", question: "ทริปพักผ่อนธรรมชาติที่คุณชอบมากที่สุด?", optionA: "ทะเล เกาะ หาดทราย", optionB: "ภูเขา ป่า กางเต็นท์", optionC: "น้ำตก แช่น้ำเย็นๆ", optionD: "ชนบท ทุ่งนาเขียวขจี", category: "Travel" },
  { questionId: "q_27", question: "ประเทศแรกในเอเชียที่คุณอยากไปเที่ยวที่สุด?", optionA: "ญี่ปุ่น", optionB: "เกาหลีใต้", optionC: "จีน", optionD: "สิงคโปร์", category: "Travel" },
  { questionId: "q_28", question: "การเดินทางในกรุงเทพฯ ที่คุณไว้ใจที่สุดเวลาเร่งด่วน?", optionA: "รถไฟฟ้า BTS / MRT", optionB: "มอเตอร์ไซค์รับจ้าง", optionC: "เรือโดยสารคลองแสนแสบ", optionD: "ขับรถยนต์ส่วนตัว", category: "Travel" },
  { questionId: "q_29", question: "ถ้าต้องนั่งเครื่องบินไฟล์ตยาวเกิน 6 ชั่วโมง ที่นั่งในฝันคือ?", optionA: "ริมหน้าต่าง ดูวิวถ่ายรูป", optionB: "ริมทางเดิน ลุกเข้าห้องน้ำง่าย", optionC: "ตรงกลาง ไม่เกี่ยง", optionD: "แถวหน้าสุด ยืดขาได้เต็มที่", category: "Travel" },
  { questionId: "q_30", question: "สิ่งของสำคัญที่สุดที่ต้องเช็กซ้ำ 3 รอบก่อนออกจากบ้าน?", optionA: "โทรศัพท์มือถือ", optionB: "กระเป๋าสตางค์ / บัตร", optionC: "กุญแจห้อง / กุญแจรถ", optionD: "พาวเวอร์แบงก์ / สายชาร์จ", category: "Travel" },

  // หมวดชีวิตนักศึกษา & ห้องเรียน (PIM & Classroom)
  { questionId: "q_31", question: "ที่นั่งเรียนในฝันของคุณเวลาเข้าห้องเลกเชอร์?", optionA: "แถวหน้าสุด เกาะติดอาจารย์", optionB: "แถวกลางห้อง มุมโฟกัสกำลังดี", optionC: "แถวหลังสุด มองเห็นทั้งห้อง", optionD: "ริมหน้าต่าง / ริมประตู ลุกสะดวก", category: "Classroom" },
  { questionId: "q_32", question: "อุปกรณ์จดบันทึกที่คุณถนัดมือที่สุด?", optionA: "iPad / แท็บเล็ตพร้อมปากกา", optionB: "แล็ปท็อปพิมพ์รัวๆ", optionC: "สมุดโน้ตกับปากกาสี", optionD: "ใช้สายตาจำอย่างเดียว", category: "Classroom" },
  { questionId: "q_33", question: "ถ้าได้รับมอบหมายงานกลุ่ม บทบาทที่คุณอยากทำที่สุดคือ?", optionA: "ผู้นำกลุ่ม คุมทิศทาง", optionB: "ฝ่ายหาข้อมูลและเนื้อหา", optionC: "ฝ่ายทำสไลด์ กราฟิกดีไซน์", optionD: "ฝ่ายนำเสนอหน้าห้อง (Presenter)", category: "Classroom" },
  { questionId: "q_34", question: "พฤติกรรมเวลาเจอเดดไลน์งานในอีก 24 ชั่วโมงข้างหน้า?", optionA: "ทำงานเสร็จล่วงหน้าไปนานแล้ว", optionB: "เพิ่งเริ่มปั่นคืนนี้ พลังไฟลนก้น", optionC: "ทยอยทำเรื่อยๆ เหลือตรวจทาน", optionD: "ขอต่อรองอาจารย์เลื่อนส่ง", category: "Classroom" },
  { questionId: "q_35", question: "เมนูมื้อเที่ยงยอดฮิตรอบรั้วสถาบัน?", optionA: "ข้าวราดแกง เลือกกับ 2 อย่าง", optionB: "ไก่ทอด ข้าวเหนียว รวดเร็วทันใจ", optionC: "อาหารตามสั่ง สั่งไข่ดาวเพิ่ม", optionD: "ของกินใน 7-Eleven เดินตากแอร์", category: "Classroom" },
  { questionId: "q_36", question: "การฝึกงาน Work-based Education ทักษะใดที่คุณคิดว่าสำคัญที่สุด?", optionA: "ความอดทนและสู้งานหนัก", optionB: "มนุษยสัมพันธ์และการสื่อสาร", optionC: "ความใฝ่รู้และปรับตัวเร็ว", optionD: "ความตรงต่อเวลาและระเบียบวินัย", category: "PIM" },
  { questionId: "q_37", question: "ถ้าต้องแก้ปัญหาเฉพาะหน้าในการทำงานจริง คุณจะเริ่มจากอะไร?", optionA: "ปรึกษาพี่เลี้ยงหรือหัวหน้าทันที", optionB: "ค้นหาข้อมูลใน Google/AI ก่อน", optionC: "ระดมสมองกับเพื่อนร่วมทีม", optionD: "ลองลงมือแก้เองตามสัญชาตญาณ", category: "PIM" },
  { questionId: "q_38", question: "กิจกรรมรับน้องหรือกระชับมิตรที่คุณอยากให้มีมากที่สุด?", optionA: "แข่งเกม E-Sports / บอร์ดเกม", optionB: "คอนเสิร์ตวงดนตรีรุ่นพี่-รุ่นน้อง", optionC: "ลานกิจกรรมกีฬาฮาเฮ", optionD: "ปาร์ตี้หมูกระทะสานสัมพันธ์", category: "Classroom" },
  { questionId: "q_39", question: "สิ่งที่ทำให้คุณตื่นเต้นที่สุดในการเริ่มเทอมใหม่?", optionA: "ได้เจอเพื่อนๆ หลังปิดเทอม", optionB: "ได้เรียนวิชาใหม่ที่สนใจ", optionC: "ซื้อชุดนักศึกษาและเครื่องเขียนใหม่", optionD: "รอวันหยุดนักขัตฤกษ์ของเทอม", category: "Classroom" },
  { questionId: "q_40", question: "คำนิยามความเป็น 'บัณฑิตมืออาชีพ' สำหรับคุณคือ?", optionA: "เชี่ยวชาญงาน ทำงานเป็นตั้งแต่วันแรก", optionB: "มีคุณธรรม ซื่อสัตย์ ไว้วางใจได้", optionC: "มีความเป็นผู้นำ พร้อมรับความเปลี่ยนแปลง", optionD: "สื่อสารยอดเยี่ยม ทำงานร่วมกับใครก็ได้", category: "PIM" },

  // หมวดจิตวิทยาและการตัดสินใจ (Mind Game)
  { questionId: "q_41", question: "ถ้าคุณสามารถย้อนเวลากลับไปได้ 1 ครั้ง?", optionA: "ย้อนไปแก้ไขความผิดพลาดในอดีต", optionB: "ย้อนไปบอกเลขเด็ดรางวัลที่ 1", optionC: "ย้อนไปใช้เวลากับคนที่คิดถึง", optionD: "ไม่ย้อน อยู่กับปัจจุบันดีที่สุด", category: "MindGame" },
  { questionId: "q_42", question: "ถ้าเลือกพลังวิเศษได้ 1 อย่างในการใช้ชีวิต?", optionA: "หายตัวได้ไร้ร่องรอย", optionB: "อ่านใจคนอื่นได้ทะลุปรุโปร่ง", optionC: "เทเลพอร์ตไปไหนก็ได้ในพริบตา", optionD: "ควบคุมเวลา ยืดหรือหยุดได้", category: "MindGame" },
  { questionId: "q_43", question: "คุณคิดว่าคนส่วนใหญ่ในห้องนี้มองโลกในแง่ไหนมากกว่ากัน?", optionA: "มองโลกตามความเป็นจริง (Realist)", optionB: "มองโลกในแง่บวก (Optimist)", optionC: "มองโลกในแง่ระมัดระวัง (Pragmatist)", optionD: "มองโลกในแง่ตลกขบขัน (Humorist)", category: "MindGame" },
  { questionId: "q_44", question: "สีของเสื้อที่คุณหยิบใส่บ่อยที่สุดในตู้เสื้อผ้า?", optionA: "สีดำ เท่ สุภาพ เข้าได้กับทุกชุด", optionB: "สีขาว สะอาด สบายตา", optionC: "สีเอิร์ธโทน ครีม น้ำตาล มินิมอล", optionD: "สีสดใส เด่นสะดุดตา", category: "Lifestyle" },
  { questionId: "q_45", question: "ในการแข่งขันนี้ คุณคิดว่าตัวเลือกใดที่คนส่วนใหญ่จะกดเลือกข้อนี้มากที่สุด?", optionA: "ข้อ A (ตัวเลือกแรกสุด มักจะปลอดภัย)", optionB: "ข้อ B (ตัวเลือกยอดนิยมของสายกลาง)", optionC: "ข้อ C (ช้อยส์ทองคำที่มักจะถูก)", optionD: "ข้อ D (ตัวเลือกลึกลับสำหรับคนคิดต่าง)", category: "MindGame" },
  { questionId: "q_46", question: "ถ้าต้องเลือกฟังเพลงไทยเพียงยุคเดียว?", optionA: "เพลงฮิต T-Pop ยุคปัจจุบัน", optionB: "เพลงอินดี้ / นอกกระแส ฟังสบาย", optionC: "เพลงยุค 90s - 2000s คลาสสิก", optionD: "เพลงร็อก ยุคสยามสแควร์", category: "Entertainment" },
  { questionId: "q_47", question: "ถ้าคุณเจอคนทำเงินตก 500 บาทต่อหน้าคุณ สิ่งที่คุณจะทำคือ?", optionA: "เก็บแล้ววิ่งเอาไปคืนเจ้าของทันที", optionB: "ยืนเรียกเจ้าของให้หันมาเก็บ", optionC: "แจ้งเจ้าหน้าที่ รปภ. / ประชาสัมพันธ์", optionD: "ลังเล มองซ้ายมองขวา", category: "MindGame" },
  { questionId: "q_48", question: "คุณคิดว่าความสำเร็จในการทำงานขับเคลื่อนด้วยสิ่งใดมากที่สุด?", optionA: "ความพยายามและวินัยส่วนตัว 99%", optionB: "คอนเนกชันและโอกาสที่เหมาะสม", optionC: "ทัศนคติและวิธีคิด (Mindset)", optionD: "ความฉลาดและไหวพริบ", category: "PIM" },
  { questionId: "q_49", question: "ถ้ามีเวลาว่าง 1 ชั่วโมง คุณเลือกที่จะ?", optionA: "งีบหลับเติมพลัง", optionB: "ออกกำลังกาย / วิ่งเบิร์นแคล", optionC: "ดูซีรีส์ตอนใหม่", optionD: "คุยโทรศัพท์กับเพื่อนสนิท", category: "Lifestyle" },
  { questionId: "q_50", question: "คำถามสุดท้าย: จบเกมนี้แล้วอยากไปกินอะไรฉลองกับเพื่อน?", optionA: "ชาบู ชาบู น้ำดำร้อนๆ", optionB: "หมูกระทะ เยียวยาทุกสิ่ง", optionC: "บิงซู / ของหวานดับร้อน", optionD: "กลับหอพัก นอนอิ่มๆ ดีที่สุด", category: "Food" }
];

async function fetchQuestionsFromGoogleSheet(sheetIdOrUrl) {
  let sheetId = sheetIdOrUrl.trim();
  const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) sheetId = match[1];

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Questions`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("ไม่สามารถดาวน์โหลดไฟล์จาก Google Sheets ได้ (โปรดตรวจสิทธิ์การแชร์ว่า 'ทุกคนที่มีลิงก์มีสิทธิ์ดู')");
  
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length <= 1) throw new Error("ไม่พบข้อมูลคำถามในชีต Questions");

  const parsedQuestions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[1] && row[1].trim() !== "") {
      parsedQuestions.push({
        questionId: row[0] || ("q_" + i),
        question: row[1],
        optionA: row[2] || "-",
        optionB: row[3] || "-",
        optionC: row[4] || "-",
        optionD: row[5] || "-",
        category: row[6] || "General"
      });
    }
  }
  return parsedQuestions;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(line => {
    const result = [];
    let insideQuotes = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  });
}

module.exports = {
  DEFAULT_QUESTIONS,
  fetchQuestionsFromGoogleSheet
};
