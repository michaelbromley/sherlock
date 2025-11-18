# Cycles Table

## Overview
The `Cycles` table is one of the most comprehensive and important tables in the SRP database. It stores statistical snapshots for each cluster during specific time periods (cycles), capturing a complete picture of community activities, educational progress, population demographics, and community life. Each cycle represents a reporting period (typically 3 months) during which the cluster's activities and growth are measured and recorded.

This table is central to tracking the growth and development of the Bahai community over time, enabling trend analysis, strategic planning, and evaluation of community-building efforts.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL)

The primary key and unique identifier for each cycle record in the database. This auto-incrementing field ensures that every statistical reporting cycle has a distinct, permanent reference point that remains constant throughout the cycle's lifecycle and any subsequent analysis. The Id serves as the fundamental link for all queries and reports that analyze cycle data over time, enabling historical trend analysis and comparison of cluster development across different reporting periods.

This identifier is crucial for tracking the progression of community statistics, as each cycle builds on previous periods to show patterns of growth, stability, or areas needing attention. When coordinators review multi-cycle reports to understand how a cluster is evolving, this Id provides the stable anchor that connects each snapshot to its specific time period.

### DisplayStartDate (varchar, NULL)

A human-readable representation of when the statistical reporting cycle begins, formatted for display in user interfaces, reports, and printed materials. This field allows for flexible date formats that may vary by region or organizational preference, such as "April 2024", "Ridván 181", or "Q2 2024", providing context that resonates with the intended audience while the companion StartDate field maintains precise system-level accuracy.

The varchar format accommodates cultural and calendar variations across the global Bahá'í community, where some regions may reference the Bahá'í calendar (which begins each year at the spring equinox with the festival of Ridván) while others use Gregorian calendar references. This flexibility is essential for a multi-national database serving diverse communities, ensuring that statistical reports are presented in culturally relevant formats while maintaining data consistency at the system level.

### StartDate (datetime, NULL)

The precise datetime when the statistical reporting cycle officially begins, stored in a machine-readable format suitable for system calculations, temporal queries, and automated report generation. This field serves as the authoritative timestamp for determining which activities, enrollments, and other events fall within the cycle's boundaries, enabling accurate aggregation of statistics across the entire reporting period.

While cycles typically align with three-month planning periods (often coinciding with major Bahá'í calendar events like Ridván, which marks the beginning of the Bahá'í year), the datetime precision allows for exact temporal boundaries. This precision is essential when activities or events occur near cycle boundaries, ensuring they are correctly attributed to the appropriate reporting period. The nullable nature accommodates legacy data or special cases where exact dates may not be known, though current practice requires this field to be populated for operational cycles.

### DisplayEndDate (varchar, NULL)

A human-readable representation of when the statistical reporting cycle concludes, formatted for presentation in reports, dashboards, and communications to coordinators and community members. This field works in tandem with DisplayStartDate to create user-friendly cycle identifiers such as "April - June 2024" or "Ridván - Summer 2024", making it immediately clear to readers which time period the statistics represent without requiring interpretation of technical datetime values.

The flexibility of the varchar format is particularly valuable for communicating cycle boundaries in regional reports and presentations, where the audience may include coordinators, community members, and institutional representatives who benefit from familiar date representations rather than precise timestamps. This field enhances the accessibility of statistical reports while the companion EndDate field maintains the technical precision needed for accurate data processing.

### EndDate (datetime, NULL)

The precise datetime marking the conclusion of the statistical reporting cycle, establishing the exact boundary for which activities, enrollments, and community developments are included in the cycle's statistical summary. This field is essential for determining the temporal scope of all calculated metrics in the cycle record, ensuring that every statistic accurately reflects the designated time period.

The EndDate works in conjunction with StartDate to define a complete temporal window, typically spanning three months, during which all community activity metrics are captured and aggregated. When the system calculates statistics like book completions or new enrollments "during cycle", it relies on this field to determine which individual records and activity completions fall within the cycle's boundaries. The nullable nature of this field accommodates cycles that are currently in progress or historical records where exact end dates may not have been recorded, though established cycles should always have defined end boundaries for accurate reporting.

### FriendsParticipatingInExpansionPhase (int, NOT NULL)

Represents the count of individuals actively engaged in organized expansion activities during this cycle—those friends who are participating in systematic efforts to extend the reach of core activities, share the teachings, and build relationships with new populations. This metric captures the human capacity mobilized for growth during the cycle, reflecting not just passive membership but active, purposeful participation in the expansion phase of community building.

This field is foundational to understanding a cluster's development trajectory, as the number of friends in the expansion phase directly correlates with the cluster's ability to sustain growth in core activities and community engagement. A cluster with increasing numbers in this field demonstrates growing capacity for outreach and consolidation, while stagnant or declining numbers may indicate a need for renewed focus on the educational process that builds capacity for service. Coordinators use this metric to assess whether sufficient human resources are mobilized to support the cluster's goals for the cycle.

The term "expansion phase" reflects a specific period of intensified outreach activity, typically involving home visits, conversations about spiritual themes, invitations to devotional gatherings, and efforts to identify receptive populations. Friends participating in this phase have typically completed at least the initial books of the Ruhi sequence, equipping them with the understanding and skills needed for meaningful engagement with their neighbors and extended social networks.

### CompletedBook1 (int, NOT NULL)

Tracks the cumulative number of individuals in the cluster who have completed Book 1 "Reflections on the Life of the Spirit" as of the end of this cycle. This foundational course introduces participants to the concept of prayer as conversation with God, explores the nature of the soul, and helps individuals develop a habit of daily reflection and spiritual practice. As the entry point to the Ruhi Institute sequence, Book 1 represents the beginning of a systematic educational journey that builds capacity for service.

The count in this field reflects not just completions during the current cycle, but the total number of friends in the cluster who have completed Book 1 at any point up to the cycle's end date. This cumulative approach allows coordinators to track the cluster's overall educational capacity over time, understanding how many individuals have taken the first step in the institute process. A growing Book 1 count indicates effective outreach and invitation to the educational process, while the ratio between Book 1 completions and subsequent books helps identify where participants may need additional support or encouragement to continue the sequence.

Book 1 completions serve as a critical baseline metric for cluster development, as this first course establishes patterns of study, reflection, and practice that form the foundation for all subsequent learning. Communities often organize multiple Book 1 study circles simultaneously to welcome new participants and create entry points for those interested in exploring spiritual themes in a supportive group environment.

### CompletedBook2 (int, NOT NULL)

Records the cumulative total of individuals who have completed Book 2 "Arising to Serve", which builds on Book 1 by exploring the purpose of life as service to humanity and introducing the concept of Bahá'u'lláh's Revelation as a source of spiritual and social transformation. This course helps participants understand that spiritual development and service are inseparable, encouraging them to arise and actively contribute to the betterment of their communities.

The progression from Book 1 to Book 2 represents an important transition in the institute process, as participants move from establishing personal spiritual practices to understanding how those practices connect to broader patterns of service. Coordinators monitor the ratio between Book 1 and Book 2 completions to understand how effectively the community is supporting participants through the early stages of the sequence. A healthy pattern shows strong Book 2 completion relative to Book 1, indicating that participants are continuing their educational journey rather than stopping after the initial course.

Book 2's emphasis on service to humanity prepares participants for the more specialized courses that follow, whether teaching children (Book 3), empowering junior youth (Book 5), teaching the Faith (Book 6), or serving as tutors (Book 7). The concepts introduced in Book 2 create the motivational foundation that sustains individuals through the challenges and rewards of systematic service.

### CompletedBook3G1 (int, NOT NULL)

Counts individuals who have completed Book 3 Grade 1, the first level of training for teachers of children's classes. This course equips participants with the understanding, skills, and materials needed to offer regular classes that nurture the spiritual education of children ages 5-11. Grade 1 introduces basic pedagogical approaches, explores the importance of moral education, and provides practical experience in teaching fundamental spiritual concepts through stories, songs, prayers, games, and artistic activities.

Book 3 Grade 1 represents a critical branch point in the Ruhi sequence, as it prepares friends to take on the specific role of children's class teacher—one of the four core activities essential to community building. The number in this field directly correlates with a cluster's capacity to expand and sustain children's classes, as each completion represents a potential new teacher who can serve in their neighborhood. Regional coordinators monitor Book 3 completions closely, as shortages of trained teachers often limit the growth of children's classes even when demand exists.

The grade structure of Book 3 (with grades 1-5 available) allows teachers to progressively deepen their understanding and skills while remaining engaged in active service. Grade 1 provides sufficient preparation to begin teaching, while subsequent grades enhance pedagogical sophistication and explore more advanced moral and spiritual concepts appropriate for older children or multi-age groups.

### CompletedBook3G2 (int, NOT NULL)

Represents the cumulative count of friends who have progressed to complete Book 3 Grade 2, building on the foundation established in Grade 1 with more advanced pedagogical concepts and deeper exploration of moral education for children. Grade 2 helps teachers refine their skills, expand their repertoire of teaching methods, and address the needs of children at different developmental stages. This progression indicates a cluster's commitment to developing excellence in children's spiritual education rather than merely establishing basic capacity.

Completion of Book 3 Grade 2 typically correlates with teachers who have practical classroom experience and are seeking to enhance their effectiveness and understanding. The number in this field helps coordinators assess the depth of teacher development in the cluster—a community with many Book 3 Grade 2 completions demonstrates sustained investment in educational quality, not just initial capacity building. This depth of preparation supports the establishment of more sophisticated children's class programs that can serve larger numbers of children or address specific local contexts and needs.

### CompletedBook3G3 (int, NOT NULL)

Tracks completions of Book 3 Grade 3, representing further advancement in the preparation of children's class teachers who have demonstrated sustained commitment to this vital area of service. Grade 3 introduces even more sophisticated understanding of child development, moral education, and the integration of spiritual principles into age-appropriate learning experiences. Teachers at this level typically have significant practical experience and are often supporting other teachers or coordinating children's class programs at the locality or cluster level.

The presence of Grade 3 completions in a cluster indicates mature development of the children's class program, with experienced teachers who can mentor newcomers, adapt materials to local contexts, and maintain high standards of educational quality. Coordinators value these highly trained teachers as a stable resource for sustaining and expanding children's classes, knowing they possess both theoretical understanding and practical wisdom gained through cycles of teaching and reflection.

### CompletedBook3G4 (int, NOT NULL)

Records the number of friends who have completed Book 3 Grade 4, representing advanced development in children's spiritual education. This course builds on the foundations of earlier grades, providing sophisticated pedagogical approaches and deeper spiritual insights that enable teachers to serve children with increasing effectiveness and spiritual perception. Grade 4 completion typically indicates teachers who have years of experience and are recognized as resources for children's class development in their clusters.

### CompletedBook3G5 (int, NOT NULL)

Captures completions of Book 3 Grade 5, the most advanced level of the Book 3 sequence for children's class teachers. Friends who complete this level represent the highest tier of educational preparation for children's spiritual education within the Ruhi framework, combining deep spiritual understanding with sophisticated pedagogical skills and extensive practical experience. These individuals often serve as regional resources, supporting clusters in developing and strengthening their children's class programs.

### CompletedBook4 (int, NOT NULL)

Records the cumulative number of individuals who have completed Book 4 "The Twin Manifestations", which explores the lives, teachings, and spiritual significance of the Báb and Bahá'u'lláh—the Twin Founders of the Bahá'í Faith. This course deepens participants' understanding of the station of these Divine Manifestations and the transformative power of Their Revelation for individual lives and human society. Book 4 marks a return to the main sequence after the specialized branch of Book 3, continuing the progressive education of all participants regardless of their specific areas of service.

Completion of Book 4 indicates participants who are advancing through the core sequence with a deepening understanding of Bahá'í theology and history. The concepts explored in this book strengthen participants' conviction and understanding, equipping them for more effective teaching and service. Coordinators observe that friends who complete Book 4 often demonstrate greater confidence in sharing the teachings and a deeper sense of the privilege of serving the Cause of Bahá'u'lláh.

This course serves as important preparation for Book 6 (Teaching the Cause), as understanding the station of the Twin Manifestations provides the spiritual foundation for effectively sharing Their message with others. The historical and theological depth of Book 4 also supports participants in engaging with seekers' questions and exploring themes of progressive revelation, divine guidance, and the purpose of the Bahá'í Revelation in contemporary society.

### CompletedBook5 (int, NOT NULL)

Tracks completions of Book 5 "Releasing the Powers of Junior Youth", which prepares individuals to serve as animators of junior youth groups—empowerment programs for young people ages 12-15 that help them navigate this critical developmental period with a strong moral and spiritual foundation. Book 5 introduces the junior youth spiritual empowerment program, explores the unique capacities emerging during early adolescence, and equips participants to facilitate group activities that strengthen moral reasoning, develop powers of expression, and engage junior youth in acts of service to their communities.

The junior youth program represents one of the four core activities, and Book 5 completions directly correlate with a cluster's capacity to serve this age group. Each completion represents a potential animator who can form and accompany a junior youth group, making this metric critical for clusters seeking to expand their reach to early adolescents. The number in this field helps coordinators assess whether sufficient human resources exist to serve the junior youth population, which research and experience have shown to be a pivotal age for moral and spiritual development.

Book 5's approach to junior youth empowerment emphasizes building capacity for service rather than merely providing activities or entertainment. Animators learn to create an environment where junior youth explore concepts of moral excellence, develop their intellectual and expressive powers, and take on meaningful service projects that contribute to their communities—all while navigating the challenges and opportunities of early adolescence with spiritual support and guidance.

### CompletedBook5BR1 (int, NOT NULL)

Represents completions of Book 5 Branch 1, an extension of the Book 5 sequence that provides animators with additional materials, insights, and approaches for serving junior youth. The branch courses of Book 5 enable animators to deepen their understanding and expand their repertoire of texts and activities, supporting more effective and nuanced engagement with junior youth groups over time.

### CompletedBook5BR2 (int, NOT NULL)

Tracks completions of Book 5 Branch 2, further advancing animators' capacity to serve junior youth through additional materials and deepened understanding of the spiritual empowerment program. Friends who complete multiple branches of Book 5 demonstrate sustained commitment to this field of service and typically bring greater sophistication and effectiveness to their work with junior youth.

### CompletedBook5BR3 (int, NOT NULL)

Records the number who have completed Book 5 Branch 3, representing advanced preparation for junior youth animators who are committed to excellence in this vital area of community building. Completion of multiple Book 5 branches indicates a cluster's investment in developing highly skilled animators who can adapt to diverse junior youth populations and contexts.

### CompletedBook6 (int, NOT NULL)

Counts individuals who have completed Book 6 "Teaching the Cause", which develops participants' understanding of the spiritual nature of teaching and equips them with approaches and skills for sharing Bahá'u'lláh's message in conversations, firesides, and other teaching opportunities. This course explores the spiritual dynamics of teaching, the importance of love and attraction in sharing the Faith, and practical methods for engaging with seekers at various levels of receptivity. Book 6 builds directly on the theological foundation of Book 4, helping participants translate their understanding of the Revelation into effective teaching activity.

Completion of Book 6 represents a significant milestone in the institute process, as teaching the Faith is both a spiritual obligation and a source of spiritual growth for every Bahá'í. Friends who complete this course are equipped to contribute more systematically to expansion efforts, whether through personal initiative in their social networks or through participation in organized teaching campaigns. The number of Book 6 completions in a cluster provides insight into the community's capacity for sustained teaching activity and expansion.

The teaching approaches introduced in Book 6 emphasize spiritual qualities—such as love, humility, and detachment—alongside practical skills for conversing about spiritual themes, responding to questions, and inviting individuals to participate in the devotional and educational life of the community. This combination of spiritual and practical preparation helps participants become more confident and effective in sharing the teachings while maintaining the spiritual character essential to Bahá'í teaching.

### CompletedBook7 (int, NOT NULL)

Records completions of Book 7 "Walking Together on a Path of Service", which prepares participants to serve as tutors of study circles—facilitating the very courses they have completed in the Ruhi sequence. This course explores the spiritual dynamics of accompanying others on their educational journey, develops skills for creating a learning environment characterized by mutual support and encouragement, and provides practical guidance for tutoring study circles effectively. Book 7 represents a critical capacity-building milestone, as each completion multiplies the cluster's ability to expand the educational process.

The number of friends who have completed Book 7 directly impacts a cluster's capacity for growth in all other areas, since tutors are needed to offer the study circles that prepare teachers, animators, and teachers of the Faith. A cluster with growing Book 7 completions demonstrates the emergence of a self-sustaining educational process, where new tutors continuously enable new study circles, which in turn prepare more participants for service, some of whom become tutors themselves. This multiplying effect makes Book 7 completions a key indicator of cluster development and institutional capacity.

Tutors trained through Book 7 learn to create study circles that go beyond mere information transfer, fostering an environment of spiritual learning where participants reflect on concepts, practice skills, and support each other in translating study into action. The course emphasizes that tutors are fellow learners who walk alongside participants rather than authoritative teachers, creating a humble and collaborative approach to education that characterizes the institute process.

### CompletedBook7BR1 (int, NOT NULL)

Tracks completions of Book 7 Branch 1, which provides tutors with additional materials and insights for facilitating study circles more effectively. The branch courses of Book 7 help tutors deepen their understanding of the educational process and refine their skills in creating learning environments that support participants' spiritual growth and development of capacity for service.

### CompletedBook7BR2 (int, NOT NULL)

Records the number who have completed Book 7 Branch 2, further advancing tutors' capacity through additional insights and approaches for accompanying participants through the Ruhi sequence. Tutors who complete multiple branches of Book 7 typically demonstrate greater skill in adapting to diverse participants and contexts while maintaining the essential character of the institute process.

### CompletedBook8U1 (int, NOT NULL)

Represents completions of Book 8 Unit 1 "The Covenant of Bahá'u'lláh", which explores the covenant established by Bahá'u'lláh to ensure the unity and integrity of the Bahá'í community. This unit introduces the concept of covenant in Bahá'í theology, examines the provisions Bahá'u'lláh made for guidance and leadership after His passing, and helps participants understand the covenant as a source of spiritual protection and community unity.

### CompletedBook8U2 (int, NOT NULL)

Tracks completions of Book 8 Unit 2, continuing the exploration of covenant themes with deeper examination of the Center of the Covenant and the role of the Administrative Order in channeling the energies of the Bahá'í community toward constructive action. Friends who complete this unit gain greater understanding of the institutional framework that guides community building and individual spiritual development.

### CompletedBook8U3 (int, NOT NULL)

Records the number who have completed Book 8 Unit 3, the concluding unit of the covenant course that deepens participants' understanding of the covenant's significance for individual faithfulness and community unity. Completion of the entire Book 8 sequence indicates mature understanding of covenant theology and its practical implications for Bahá'í life.

### CompletedBook9U1 (int, NOT NULL)

Counts individuals who have completed Book 9 Unit 1 "Gaining an Historical Perspective", which explores the historical development of the Bahá'í Faith from the Báb's declaration through the ministry of Bahá'u'lláh and the early years of the formative age. This unit provides participants with historical context essential for understanding the Bahá'í community's development and the unfoldment of Bahá'u'lláh's plan for humanity. Book 9 represents advanced study in the Ruhi sequence, typically undertaken by participants who have completed most or all of the earlier books.

The historical perspective gained through Book 9 Unit 1 enriches participants' understanding of the Revelation and its impact on human affairs, helping them recognize the processes by which spiritual truth transforms individuals and societies over time. This understanding supports more effective teaching and a deeper appreciation for the community's current efforts as part of a vast historical arc of spiritual and social transformation.

### CompletedBook9U2 (int, NOT NULL)

Tracks completions of Book 9 Unit 2, continuing the historical exploration through subsequent periods of Bahá'í history and examining themes of crisis and victory that characterize the community's development. Friends who complete this unit gain sophisticated understanding of how the Bahá'í Faith has developed institutionally and expanded geographically, providing context for contemporary community-building efforts.

### CompletedBook9U3 (int, NOT NULL)

Records the number who have completed Book 9 Unit 3, the final unit of the historical course that brings the narrative forward and explores the implications of this history for current and future developments. Completion of the entire Book 9 sequence represents significant educational achievement and typically indicates participants who serve as resources for cluster development and regional activities.

### CompletedBook10U1 (int, NOT NULL)

Represents completions of Book 10 Unit 1 "Building Vibrant Communities", which explores themes of community life, social cohesion, and the spiritual dynamics that create vibrant, unified communities characterized by worship, learning, and service. This advanced course helps participants understand the patterns of action that build strong communities and the spiritual qualities that sustain them over time.

### CompletedBook10U2 (int, NOT NULL)

Tracks completions of Book 10 Unit 2, continuing the exploration of community-building themes with focus on specific dimensions of community life such as the integration of worship and service, the education of children and junior youth, and the development of capacity for collective action. Friends who complete this unit develop deeper insight into the organic processes by which communities grow and mature.

### CompletedBook10U3 (int, NOT NULL)

Records the number who have completed Book 10 Unit 3, the concluding unit that synthesizes themes from the entire course and explores the vision of vibrant communities as expressions of Bahá'u'lláh's teachings in action. Completion of Book 10 indicates participants with sophisticated understanding of community development and the processes of social transformation.

### CompletedBook11U1 (int, NOT NULL)

Counts individuals who have completed Book 11 Unit 1, an advanced course in the Ruhi sequence that explores specialized themes relevant to mature participants who are contributing significantly to cluster development and regional activities. These advanced courses serve friends who have completed substantial portions of the main sequence and are ready for deeper exploration of specific themes.

### CompletedBook11U2 (int, NOT NULL)

Tracks completions of Book 11 Unit 2, continuing the advanced study introduced in Unit 1 with further exploration of themes that support friends in their ongoing service and spiritual development. The presence of Book 11 completions in a cluster indicates a maturing educational process with participants progressing through advanced materials.

### CompletedBook11U3 (int, NOT NULL)

Records the number who have completed Book 11 Unit 3, representing the full course and indicating participants who have achieved significant depth in the institute process and are typically serving as regional resources or coordinators in their areas.

### CompletedBook12U1 (int, NOT NULL)

Represents completions of Book 12 Unit 1, another advanced course designed for participants who have progressed substantially through the Ruhi sequence and are engaged in significant service to their clusters and regions. The advanced books serve to deepen understanding and strengthen capacity for friends who are taking on increasingly complex and responsible roles.

### CompletedBook12U2 (int, NOT NULL)

Tracks completions of Book 12 Unit 2, continuing the advanced study with additional insights and approaches relevant to experienced participants who are contributing to cluster and regional development. These completions indicate a cluster's capacity for sophisticated service and mature institutional development.

### CompletedBook12U3 (int, NOT NULL)

Records the number who have completed Book 12 Unit 3, the full course representing advanced educational achievement and typically correlating with participants who serve in coordination, training, or institutional support roles at cluster and regional levels.

### CompletedBook13U1 (int, NOT NULL)

Counts individuals who have completed Book 13 Unit 1, part of the continuing sequence of advanced courses that serve participants who have substantial experience in the educational process and significant records of service. The advanced books enable ongoing learning for mature participants.

### CompletedBook13U2 (int, NOT NULL)

Tracks completions of Book 13 Unit 2, further advancing participants' understanding and capacity through specialized themes and approaches relevant to their ongoing service and development. The presence of these advanced completions indicates a cluster with depth of educational experience.

### CompletedBook13U3 (int, NOT NULL)

Records the number who have completed Book 13 Unit 3, representing the full advanced course and indicating participants who have achieved exceptional depth in the institute process and typically serve in significant capacity-building or coordination roles.

### CompletedBook14U1 (int, NOT NULL)

Represents completions of Book 14 Unit 1, continuing the sequence of advanced materials that serve participants engaged in sophisticated service roles and ongoing spiritual and educational development. These advanced courses ensure that experienced friends have continuing opportunities for learning and growth.

### CompletedBook14U2 (int, NOT NULL)

Tracks completions of Book 14 Unit 2, further advancing participants through specialized advanced materials designed to support their ongoing service and development. The ability to offer and complete these advanced courses indicates organizational maturity and depth of educational capacity.

### CompletedBook14U3 (int, NOT NULL)

Records the number who have completed Book 14 Unit 3, representing the full advanced course and indicating participants at the highest levels of educational achievement within the Ruhi framework, typically serving as regional or even national resources for community development and capacity building.

### IsOverrideCompletedBookData (bit, NULL)

A boolean flag that indicates whether the book completion statistics in this cycle record have been manually overridden rather than calculated from individual participant records in the database. When set to TRUE, this flag signals that coordinators have directly entered the completion counts, and the system should not attempt to recalculate these values from source data. This override mechanism is essential for maintaining accurate statistics when the detailed individual-level data is incomplete, when importing from legacy systems that tracked only summary statistics, or when known discrepancies exist between calculated and actual completions.

The ability to override book completion data provides necessary flexibility while maintaining data integrity through clear documentation of manual intervention. Coordinators might use this flag when they have authoritative information from regional records that differs from what can be calculated from individual records, or when technical issues have prevented proper synchronization of participant-level data. The flag ensures that these manual adjustments are preserved through system updates and clearly marked for anyone analyzing the data.

### DevotionalMeetingsNumber (int, NOT NULL)

Represents the total count of devotional meetings—regular gatherings for prayer, meditation, and spiritual reflection—that were held in this cluster during the cycle. Devotional meetings serve as one of the four core activities of community building, creating spaces where people of all backgrounds can come together in worship and contemplation of spiritual truths. These gatherings are characterized by simplicity and inclusivity, typically featuring prayers and sacred writings from various religious traditions, and they play a vital role in fostering a devotional atmosphere in neighborhoods and communities.

The number of devotional meetings provides insight into the breadth of the cluster's devotional activity, though the count alone doesn't capture the full picture without considering attendance and frequency. A cluster might have many occasional devotional meetings or fewer meetings that gather regularly with strong participation. This metric, combined with attendance figures, helps coordinators understand the extent to which devotional life is becoming integrated into the fabric of community life across different neighborhoods and localities.

Devotional meetings often serve as an entry point for friends of the community who might not yet be involved in study circles or other educational activities, creating accessible opportunities for spiritual connection and relationship building. The expansion of devotional meetings across a cluster indicates growing capacity to create and sustain spaces of worship at the grassroots level, a key dimension of vibrant community life.

### DevotionalMeetingsAttendance (int, NOT NULL)

Records the total cumulative attendance across all devotional meetings held in the cluster during the cycle. This figure aggregates attendance across all meetings, providing a measure of overall participation in the devotional life of the community. Unlike the meeting count, which shows breadth of activity, the attendance figure indicates depth of engagement and the devotional meetings' reach into the broader population.

The attendance metric helps coordinators assess the vitality of the cluster's devotional life and understand how many individuals are being touched by these gatherings. High attendance relative to the number of meetings suggests well-established devotional gatherings with strong regular participation, while lower attendance might indicate newer efforts still building momentum or the need for greater emphasis on this core activity. Comparing attendance to the total Bahá'í population and including friends of the faith participation provides insight into how effectively the devotional meetings are extending beyond the Bahá'í community to serve the broader neighborhood populations.

### DevotionalMeetingsFriendsOfFaith (int, NOT NULL)

Captures the number of friends of the faith—individuals who are not Bahá'ís but participate in community activities—who attended devotional meetings during the cycle. This metric reflects a fundamental dimension of the Bahá'í approach to community building, which emphasizes creating inclusive spaces where all people can participate regardless of their religious affiliation. The presence of friends of the faith in devotional meetings demonstrates the gatherings' accessibility and their role in building bridges between the Bahá'í community and the wider population.

A healthy ratio of friends of the faith to total attendance indicates that devotional meetings are successfully serving as open, welcoming spaces rather than closed community gatherings. This inclusivity is essential to the vision of devotional meetings as neighborhood-level expressions of collective worship that draw diverse participants together in prayer and reflection. High participation by friends of the faith often correlates with devotional meetings that are well-integrated into neighborhood life, hosted in accessible locations, and characterized by genuine warmth and hospitality.

The tracking of friends of the faith participation also provides insight into the potential for expansion, as individuals who regularly attend devotional meetings often become interested in children's classes for their children, junior youth groups, or study circles for themselves. The devotional gathering thus serves as a natural entry point for progressive engagement in the life of the community.

### IsOverrideDevotionalMeetingsData (bit, NULL)

A boolean flag indicating that the devotional meeting statistics (number, attendance, and friends of faith participation) have been manually entered rather than calculated from underlying activity records. When TRUE, this flag protects the manually entered data from being overwritten by system calculations, ensuring that authoritative statistics from regional coordinators or direct observations are preserved. This override capability is particularly important for devotional meetings, which may be informal gatherings tracked less systematically than study circles or children's classes.

Devotional meetings often emerge organically in neighborhoods, sometimes operating for periods before being formally registered in the system, and they may be hosted in homes or community spaces without the detailed record-keeping that accompanies more structured educational activities. The override flag allows coordinators to capture accurate statistics based on their knowledge of the cluster's devotional life even when detailed activity records don't exist. This flexibility ensures that cycle statistics accurately reflect reality rather than being limited to only what has been formally documented in the database.

### ChildrenClassesNumber (int, NOT NULL)

Records the total number of children's classes operating in the cluster during this cycle. Children's classes represent one of the four core activities, providing spiritual and moral education for children typically ages 5-11 through regular classes that meet weekly or bi-weekly. These classes offer systematic curriculum using the Ruhi Book 3 materials and other resources, focusing on developing spiritual qualities, understanding moral concepts, and forming habits of prayer and service through age-appropriate lessons that include stories, songs, prayers, games, memorization, and artistic activities.

The count of children's classes provides a measure of the cluster's capacity to serve its child population across different localities and neighborhoods. Each children's class typically serves 10-20 children (though sizes vary), so the number of classes directly correlates with how many children can be accommodated in the educational program. Coordinators monitor this metric to understand whether sufficient classes exist to serve the children in the cluster's localities, identifying areas where new classes are needed and celebrating localities that have established sustainable programs.

The establishment and sustainability of children's classes depends on having trained teachers (Book 3 completions) and the systematic support of parents and the broader community. A growing number of children's classes indicates successful mobilization of human resources, effective teacher training, and recognition of the importance of spiritual education in the community. Conversely, stagnant or declining class counts may signal the need for additional teacher training, support for existing teachers, or renewed emphasis on the importance of this vital activity.

### ChildrenClassesAttendance (int, NOT NULL)

Captures the total number of children participating in children's classes across the cluster during the cycle. This attendance figure represents the cumulative reach of the children's class program, indicating how many young lives are being touched by systematic spiritual and moral education. Unlike the class count, which shows capacity, the attendance figure demonstrates actual participation and the program's penetration into the cluster's child population.

The attendance metric helps coordinators assess both the health of existing classes and the potential for expansion. High attendance relative to the number of classes suggests well-attended, vibrant programs, while lower attendance might indicate the need to strengthen existing classes before expanding. Comparing children's class attendance to demographic data about the cluster's child population (when available) provides insight into what percentage of children are being served, helping identify whether the program is reaching a significant portion of the target age group or whether substantial opportunity for expansion exists.

Regular, sustained attendance in children's classes has profound long-term impact on young people's spiritual development, helping them internalize spiritual principles, develop moral character, and form habits of prayer and service during formative years. Communities with strong children's class attendance often see these children progress naturally into junior youth groups and eventually into the full educational and service activities of the community as they mature.

### ChildrenClassesFriendsOfFaith (int, NOT NULL)

Represents the number of children who are not from Bahá'í families but participate in children's classes during the cycle. This metric reflects the inclusive nature of children's spiritual education, which welcomes all children regardless of their family's religious background. The presence of friends of the faith children demonstrates that the classes are successfully serving as neighborhood-level educational resources rather than closed community activities, fulfilling the vision of children's classes as a contribution to the broader community.

High participation by friends of the faith children indicates that families in the wider community recognize the value of the spiritual and moral education being offered and trust the program to serve their children well. This trust often develops through relationships built via devotional meetings, neighborhood activities, or personal friendships, showing how the different strands of community building interconnect and reinforce each other. Parents who see their children flourishing in children's classes often become interested in other community activities or in exploring Bahá'í teachings themselves.

The integration of Bahá'í children and friends of the faith children in classes creates natural opportunities for children from diverse backgrounds to learn together, develop friendships across lines that might otherwise divide, and experience the unity that characterizes Bahá'í community life. This early exposure to diversity within unity often has lasting impact on children's worldviews and relationships as they grow.

### JuniorYouthGroupsNumber (int, NOT NULL)

Records the number of junior youth groups operating in the cluster during the cycle. Junior youth groups serve young people ages 12-15 through a spiritual empowerment program that helps them navigate this critical developmental period with moral purpose, intellectual awakening, and engagement in service. These groups typically meet weekly and follow a curriculum designed specifically for early adolescence, using specially created texts that explore themes of excellence, moral choices, service, and the development of expressive and intellectual capacities.

Each junior youth group represents a sustained commitment to accompanying a cohort of young people through approximately three years of their development, creating stable environments where they can explore their emerging powers, develop moral reasoning, strengthen their sense of purpose, and take on meaningful service projects. The number of groups indicates the cluster's capacity to serve this age group, with each group typically consisting of 8-15 junior youth accompanied by a trained animator (Book 5 completion) and often an assistant or two.

The junior youth program has proven remarkably effective in helping young people develop resilience, moral clarity, and a sense of agency during a period when they are particularly susceptible to negative social influences. Clusters with growing numbers of junior youth groups demonstrate investment in this transformative program and its potential to contribute to both individual development and broader social transformation.

### JuniorYouthGroupsAttendance (int, NOT NULL)

Captures the total number of junior youth participating in empowerment groups across the cluster during the cycle. This metric represents the program's actual reach into the population of 12-15-year-olds, indicating how many young people are benefiting from systematic moral and spiritual empowerment during this formative period. The attendance figure helps coordinators understand whether the existing groups are well-populated and whether sufficient capacity exists to serve the junior youth population.

Junior youth who participate regularly in these groups often show marked development in their moral reasoning, verbal expression, analytical thinking, and commitment to service. They explore texts that challenge them intellectually while addressing themes relevant to their lived experience—friendship, peer pressure, media influence, material vs. spiritual qualities, and the purpose of life. The program's impact extends beyond the group meetings as junior youth apply what they're learning through service projects that address real needs in their communities.

Comparing junior youth group attendance to demographic data and the number of children completing children's classes helps coordinators understand the pathway from childhood through adolescence and into fuller participation in community life. A healthy pattern shows children's class graduates progressing into junior youth groups, ensuring continuity of spiritual education and relationship to the community through this critical developmental transition.

### JuniorYouthGroupsFriendsOfFaith (int, NOT NULL)

Represents the number of junior youth who are not from Bahá'í families but participate in empowerment groups during the cycle. The presence of friends of the faith junior youth demonstrates the program's appeal to families in the wider community who recognize its value for their children's development during early adolescence. Many parents in diverse communities seek positive environments for their 12-15-year-olds, and the junior youth program's emphasis on moral empowerment, intellectual development, and service resonates with families from various backgrounds.

High participation by friends of the faith junior youth indicates successful integration of the program into neighborhood life, where it serves as a genuine community resource rather than a closed activity. The friendships that develop between Bahá'í and non-Bahá'í junior youth in these groups often have lasting significance, creating bonds across backgrounds and giving all participants experience of unity in diversity. Parents of friends of the faith junior youth frequently become connected to the community through their children's participation, attending events, supporting service projects, or exploring Bahá'í teachings.

The junior youth spiritual empowerment program explicitly aims to serve all young people in this age range, recognizing that moral and spiritual development during early adolescence benefits both individuals and society regardless of religious affiliation. The inclusivity reflected in this metric demonstrates the fulfillment of that vision.

### IsOverrideJuniorYouthGroupsData (bit, NULL)

A boolean flag indicating that the junior youth group statistics (number, attendance, and friends of faith participation) have been manually entered rather than calculated from activity records. When TRUE, this flag preserves the manually entered data from system recalculations, ensuring that authoritative statistics based on coordinators' direct knowledge are maintained. This override capability is important for junior youth groups, which may involve participants who aren't formally registered in the database or where group records don't fully capture all participants.

Junior youth groups sometimes include participants who join informally through friend networks or whose families haven't completed formal registration processes, yet these participants are full members of the groups and should be counted in cycle statistics. The override flag allows coordinators to provide accurate counts that reflect reality on the ground, ensuring that cycle reports properly represent the reach and impact of the junior youth program.

### IsOverrideChildrenClassesDate (bit, NULL)

A boolean flag that indicates manual override of children's class date-related data, preserving coordinator adjustments when calculated dates don't accurately reflect the reality of class schedules and timing. This flag protects manually corrected date information from being overwritten by automated processes, ensuring that cycle statistics use the most accurate temporal boundaries for children's class activities.

### StudyCirclesNumber (int, NOT NULL)

Records the count of study circles operating in the cluster during the cycle. Study circles represent the fourth core activity, providing systematic study of the Ruhi Institute sequence and other educational materials for youth and adults. These circles typically consist of 5-12 participants who meet regularly (often weekly) with a trained tutor (Book 7 completion) to study a specific book or unit, reflect on its themes, practice its skills, and support each other in translating study into action. Study circles embody a distinctive approach to learning characterized by active participation, mutual encouragement, and connection between study and service.

The number of study circles directly indicates the cluster's educational capacity—its ability to welcome newcomers into the institute process and advance existing participants through the sequence. Each study circle represents human resources (the tutor), organizational capacity (planning and coordination), and active learning (participants engaged in the educational process). A healthy, growing cluster typically shows increasing numbers of study circles across various books, with multiple Book 1 circles welcoming new participants while circles for subsequent books advance participants along the educational pathway.

Study circles serve as the engine of capacity building in the cluster, preparing the teachers, animators, tutors, and teachers of the Faith who enable all other activities. Without sufficient study circles, the cluster cannot generate the human resources needed to expand and sustain children's classes, junior youth groups, devotional meetings, and teaching activities. Thus, the number of study circles is often considered a leading indicator of future cluster development—today's study circles prepare tomorrow's servants of the community.

### StudyCirclesAttendance (int, NOT NULL)

Captures the total number of participants in study circles across the cluster during the cycle. This attendance figure indicates how many individuals are actively engaged in the educational process, building their understanding of spiritual principles and developing capacity for service. Unlike the circle count, which shows educational infrastructure, the attendance metric demonstrates actual participation in the learning process that builds individual and collective capacity.

Study circle attendance provides insight into the cluster's commitment to education and capacity building. High attendance indicates that substantial numbers of people are dedicating time to systematic study, reflection, and practice—investing in their own spiritual and intellectual development while preparing for service. Comparing study circle attendance to the size of the Bahá'í population and to the numbers engaged in other core activities helps coordinators understand what proportion of the community is actively building capacity versus primarily engaged in other forms of service or participation.

The movement of individuals through the study circle sequence, from initial books to more advanced materials, represents a process of spiritual and intellectual growth that strengthens both the individual and the community. Communities with sustained study circle attendance typically demonstrate growing sophistication in their understanding, deeper spiritual life, and increased effectiveness in all areas of service and community building.

### StudyCirclesFriendsOfFaith (int, NOT NULL)

Represents the number of friends of the faith—individuals who are not Bahá'ís—participating in study circles during the cycle. The presence of friends of the faith in study circles demonstrates the accessibility and appeal of the educational materials to people of diverse backgrounds, as these participants are choosing to invest significant time in systematic study of themes from a Bahá'í educational framework. Their participation reflects trust in the community, interest in spiritual and moral themes, and often genuine friendship with Bahá'í participants or the tutor.

Friends of the faith who participate in study circles engage with the same materials as Bahá'ís, exploring themes of spiritual development, service, and social transformation through reflection on Bahá'í writings alongside other sources. This participation often deepens their understanding of Bahá'í teachings and principles, while their presence enriches the study circle with diverse perspectives and questions. Many friends of the faith who complete portions of the Ruhi sequence, particularly Books 1 and 2, report significant personal spiritual growth even without formal affiliation with the Faith.

The inclusivity demonstrated by friends of the faith participation in study circles reflects the Bahá'í understanding that spiritual truth is accessible to all people and that the educational process serves human development broadly rather than merely preparing believers for service. Study circles with diverse participants often develop particularly rich conversations and strong bonds of friendship, exemplifying the unity in diversity that characterizes Bahá'í community life.

### IsOverrideStudyCirclesData (bit, NULL)

A boolean flag indicating that the study circle statistics (number, attendance, and friends of faith participation) have been manually entered rather than calculated from activity records in the database. When TRUE, this flag protects the manually entered values from being overwritten, ensuring that authoritative statistics from regional coordinators or institute coordinators are preserved even when underlying activity records are incomplete or inconsistent.

Study circles are sometimes organized informally or coordinated through regional training institutes that maintain separate record systems, and the override flag allows cycle statistics to accurately reflect this activity even when detailed activity-level records don't exist in the local database. Coordinators use this flag to ensure that all educational activity is properly counted in cycle reports, supporting accurate assessment of the cluster's capacity-building efforts.

### ChildrenAndJuniorYouthRegisteredDuringCycle (int, NOT NULL)

Records the number of children and junior youth (ages 0-15) who were enrolled in the Bahá'í Faith during this specific cycle. This metric captures growth in the youngest segments of the community, typically representing children from Bahá'í families who reach the age of spiritual understanding and independently affirm their belief in Bahá'u'lláh, as well as children and junior youth from other backgrounds who choose to enroll. These enrollments represent an important dimension of community growth, as they bring young people into formal relationship with the Faith during their formative years.

The registration of children and junior youth often occurs at different ages depending on cultural context and individual spiritual development, though 15 is the traditional age of spiritual maturity in the Bahá'í Faith when individuals can independently declare belief. This metric helps coordinators understand growth patterns in the younger age cohorts and track the success of children's classes and junior youth groups in nurturing spiritual identity and commitment among participants.

### YouthAndAdultsEnrolledDuringCycle (int, NOT NULL)

Captures the number of youth and adults (ages 15 and above) who enrolled in the Bahá'í Faith during the cycle. This metric represents expansion through conversion and conscious choice, as these individuals independently investigate and embrace Bahá'í teachings, making informed commitments to the Faith. These enrollments typically result from sustained engagement with the community through core activities, teaching conversations, deepening activities, and personal relationships with Bahá'ís.

The pattern and pace of youth and adult enrollments provides crucial insight into the cluster's expansion trajectory. Sustained enrollment over multiple cycles indicates healthy growth dynamics with effective teaching activity and welcoming community culture. The ratio between enrollments and friends of the faith participating in core activities helps coordinators understand conversion patterns—how many seekers progress from initial participation to formal enrollment, and over what timeframe.

These new believers represent both the fruit of expansion efforts and a new resource for community building, as they bring fresh energy, questions, and perspectives while often maintaining strong connections to populations not yet engaged with the community. Their successful integration into community life and the educational process strongly influences long-term retention and their contribution to future growth.

### NewlyEnrolledBelieversInInstituteProcess (int, NOT NULL)

Tracks how many of the newly enrolled believers during the cycle entered the institute process by participating in at least one study circle. This metric reflects a critical dimension of consolidation—whether new believers are being welcomed into the systematic educational process that builds capacity for service and deepens spiritual understanding. Entry into the institute process, typically through Book 1, marks the beginning of a believer's journey of building capacity to serve the community and contribute to its growth.

The ratio between total enrollments and new believers entering the institute process provides important feedback on integration effectiveness. A high percentage indicates strong consolidation efforts, with new believers quickly welcomed into study circles where they can deepen their understanding and build relationships. Lower percentages may signal the need for more systematic follow-up with new believers, ensuring they're invited to study circles and supported in their early steps in community life.

New believers who enter the institute process early in their Bahá'í life typically develop stronger connections to the community, deeper understanding of the Faith, and greater capacity to contribute to growth and community building. This early integration into the educational process is therefore considered a best practice in consolidation efforts.

### IsOverrideExpansionDuringCycleData (bit, NULL)

A boolean flag indicating that the expansion statistics (children/junior youth registered, youth/adults enrolled, and newly enrolled in institute process) have been manually entered rather than calculated from individual enrollment records. When TRUE, this flag preserves the manually entered data from system recalculations, ensuring that authoritative enrollment figures are maintained even when individual records may be incomplete or delayed in entry.

Enrollment data sometimes comes from regional or national offices before individual records are fully updated in the local database, and the override flag allows cycle statistics to reflect these authoritative counts immediately. This ensures that regional reports accurately capture expansion without delays due to administrative processing of individual records.

### BahaiChildren (int, NOT NULL)

Records the total number of Bahá'í children (ages 0-11) in the cluster as of the end of this cycle. This demographic metric captures the youngest segment of the Bahá'í population, representing both children born into Bahá'í families and those who enrolled at young ages. The size of the child population has direct implications for planning children's classes and other programs serving this age group, helping coordinators ensure sufficient educational capacity exists to serve all Bahá'í children.

Understanding the child population also provides insight into demographic trends and generational patterns within the community. Communities with substantial child populations typically reflect either strong birth rates in Bahá'í families or successful integration of families with children. The child population represents the community's future, making their spiritual education through children's classes a critical priority for sustainable development.

### BahaiJuniorYouth (int, NOT NULL)

Captures the count of Bahá'í junior youth (ages 12-15) in the cluster at the cycle's end. This demographic segment is particularly important for planning and resourcing the junior youth spiritual empowerment program, as these individuals should ideally all be served by junior youth groups appropriate to their developmental stage. The junior youth population helps coordinators assess whether sufficient groups exist to serve the Bahá'í junior youth, let alone extend to friends of the faith in this age range.

The junior youth years represent a critical transition period when young people are developing their identity, moral framework, and relationship to the community. Ensuring all Bahá'í junior youth have access to empowerment groups helps them navigate this period with spiritual support and prepares them for active service as they mature into youth and then adulthood.

### BahaiYouth (int, NOT NULL)

Records the number of Bahá'í youth (typically ages 15-21, though definitions vary by region) in the cluster at cycle's end. Youth represent tremendous potential for the community, as they often have energy, idealism, time flexibility, and openness to new ideas that enable them to serve dynamically in teaching, children's classes, junior youth groups, and other activities. The youth population metric helps coordinators understand this resource and plan activities and opportunities appropriate for youth engagement.

Vibrant youth participation strengthens all dimensions of community life, and communities that successfully engage their youth in meaningful service often see accelerated growth and development. The youth years are also a critical period for spiritual deepening and capacity building, as patterns of service established during youth often continue throughout adult life.

### BahaiAdultMen (int, NOT NULL)

Captures the count of adult male Bahá'ís (typically ages 21+) in the cluster at the cycle's end. This demographic breakdown provides insight into the gender composition of the adult community and helps in understanding patterns of participation and service across gender lines. Gender-disaggregated data supports planning for gender-balanced participation in activities and institutions.

### BahaiAdultWomen (int, NOT NULL)

Records the number of adult female Bahá'ís (typically ages 21+) in the cluster at cycle's end. Along with the adult men count, this metric provides complete gender breakdown of the adult population, essential for understanding community composition and patterns of participation. The Bahá'í principle of gender equality makes gender balance in participation and service a priority in community development efforts.

### TotalBahaiBelievers (int, NOT NULL)

Represents the total count of all Bahá'ís in the cluster across all age groups and genders as of the cycle's end. This comprehensive population figure serves as the denominator for many important calculations, such as participation rates in core activities, percentage of population in the expansion phase, and ratios of activity to population. The total population provides essential context for interpreting all other cycle metrics.

Tracking total population over time reveals the cluster's overall growth trajectory, showing whether the community is expanding, stable, or declining. Population growth results from enrollments minus those who move away or are archived for other reasons, making this metric a summary indicator of expansion and consolidation dynamics over time.

### IsOverrideBahaiPopulationData (bit, NULL)

A boolean flag indicating that the population demographics (children, junior youth, youth, adult men, adult women, and total) have been manually entered rather than calculated from individual records. When TRUE, this flag preserves manually entered population counts, typically based on authoritative regional population reports or census efforts that may be more accurate than database records due to incomplete individual data entry or database maintenance issues.

Population data often comes from special census efforts or regional compilations that capture individuals not yet fully entered in the database, and the override flag ensures these authoritative counts are used in cycle statistics. This supports accurate reporting of community size and demographics even when administrative processes for maintaining individual records lag behind actual population reality.

### HomesVisitedForDeepening (int, NOT NULL)

Records the number of homes visited during the cycle for purposes of spiritual deepening, education, and consolidation. Home visits represent a personal dimension of community building, where friends visit believers' homes for prayer, study of writings, conversation about spiritual themes, and mutual encouragement. This metric captures systematic efforts to strengthen believers' understanding and connection to the Faith through intimate, personalized engagement in the familiar setting of their homes.

Home visits for deepening are particularly important in communities where believers may be geographically isolated, new to the Faith, or facing challenges that benefit from individual attention and support. These visits complement the collective activities of study circles and devotional meetings, providing opportunities for personalized deepening tailored to individual circumstances and questions. Regular home visits help ensure that all believers feel connected to community life and supported in their spiritual growth.

The practice of home visits also creates opportunities to engage entire families, allowing conversations and prayers that include children, youth, and adults together. Friends who make such visits often report that the intimacy and hospitality of the home setting enables particularly meaningful spiritual conversations and strengthens bonds of friendship that sustain community life through challenges and changes.

### LocalitiesInNineteenDayFeastHeld (int, NOT NULL)

Captures the count of localities in the cluster where Nineteen Day Feast was observed during the cycle. The Nineteen Day Feast is a distinctive Bahá'í institution held on the first day of each Bahá'í month (every 19 days), serving as the primary gathering of the Bahá'í community for worship, consultation, and fellowship. The feast provides a regular rhythm to community life and creates a space where administrative, spiritual, and social dimensions of community life converge.

The number of localities observing feast indicates the breadth of organized community life across the cluster's geographic area. In well-developed clusters, feast is held in multiple localities, allowing believers to gather in their own neighborhoods rather than traveling to central locations. This localization of feast strengthens believers' sense of belonging and enables fuller participation by those with limited mobility or transportation. Expanding feast observation to more localities represents an important dimension of community development.

Feast attendance provides one measure of community vitality and engagement, as regular participation in feast strengthens believers' connection to the institutions, keeps them informed about community activities and plans, and provides opportunities for them to contribute to consultation on community affairs. Localities that sustain regular feast observation typically demonstrate stronger community cohesion and more effective coordination of activities.

### NineteenDayFeastAttendanceEstimated (int, NOT NULL)

Records the estimated total attendance at Nineteen Day Feasts across all localities in the cluster during the cycle. Since feast occurs every 19 days, the cycle typically includes approximately 5 feast occasions, and this metric aggregates attendance across all those occasions and all localities. The attendance figure provides insight into the level of community participation in this core institution, complementing the locality count to show both breadth and depth of feast observation.

Feast attendance is typically estimated rather than precisely counted, as the emphasis during feast is on worship, consultation, and fellowship rather than administrative record-keeping. However, the estimated attendance provides valuable insight into community engagement and cohesion. High feast attendance relative to the total Bahá'í population indicates strong community life and regular participation in this institution, while lower attendance might suggest the need to strengthen feast or address barriers to participation.

Comparing feast attendance to the adult Bahá'í population helps coordinators understand what percentage of believers are regularly participating in this central community institution, providing feedback on the health of community life and the effectiveness of efforts to ensure all believers feel welcomed and engaged in the life of the community.

### LocalitiesObservedOneOrMoreHolyDays (int, NOT NULL)

Records how many localities in the cluster observed at least one Bahá'í Holy Day during the cycle. Bahá'í Holy Days commemorate significant events in Bahá'í history, including the birth and declaration of Bahá'u'lláh, the birth and martyrdom of the Báb, and other sacred occasions. On nine of these days, work is suspended, and communities gather for prayer, reflection on the significance of the occasion, and fellowship.

The number of localities observing Holy Days indicates the extent to which these sacred occasions are marked throughout the cluster's geographic area. In developing clusters, Holy Day observances might be centralized, with believers from multiple localities gathering at one location. As communities develop, capacity grows to observe Holy Days in more localities, allowing believers to celebrate in their own neighborhoods and inviting friends of the faith to participate in these commemorative gatherings.

Holy Day observances serve multiple purposes: they connect believers to the sacred history of their Faith, create occasions for inviting friends of the faith to participate in community celebrations, and strengthen community identity through regular collective observance of significant occasions. The spread of Holy Day observance across localities represents maturation of community life and institutional capacity.

### HolyDayAttendanceEstimated (int, NOT NULL)

Captures the estimated total attendance at Holy Day observances across all localities in the cluster during the cycle. A typical cycle includes several Holy Days, and this metric aggregates attendance across those occasions and all localities where they were observed. Like feast attendance, Holy Day attendance is typically estimated rather than precisely counted, focusing on participation rather than administrative record-keeping.

Holy Day attendance provides insight into community engagement with these sacred occasions and the effectiveness of efforts to make Holy Day observances accessible and meaningful. High attendance indicates that believers prioritize participation in these commemorations and that the observances are organized in ways that enable broad participation. The presence of friends of the faith at Holy Day observances also reflects successful community integration and the welcoming nature of these gatherings.

Holy Days create natural opportunities to invite friends of the community who might not yet be ready for study circles or other educational activities but are interested in experiencing community celebrations. These inclusive observances often deepen friendships between Bahá'ís and others while exposing friends of the faith to Bahá'í history and teachings in celebratory contexts.

### IsOverrideCommunityDevelopmentData (bit, NULL)

A boolean flag indicating that the community development statistics (homes visited for deepening, feast localities and attendance, Holy Day localities and attendance) have been manually entered rather than calculated from activity records. When TRUE, this flag preserves manually entered data from system recalculations, ensuring that statistics based on coordinator knowledge and observation are maintained even when detailed activity records may not exist.

Community development activities like home visits, feast, and Holy Day observances are often tracked through informal reporting or coordinator observations rather than detailed database records, and the override flag allows cycle statistics to reflect this knowledge accurately. This flexibility ensures that important dimensions of community life are properly represented in cycle reports even when formal record-keeping systems don't capture all the details.

### ClusterId (bigint, NULL)

The foreign key linking this cycle record to its specific cluster in the Clusters table. This relationship is fundamental to the table's structure, as every cycle record must be associated with a particular cluster whose statistics it represents. The ClusterId enables all queries that analyze cluster development over time, compare cycles within a cluster, or aggregate cycle statistics to regional or national levels.

This relationship places cycle statistics within the broader geographic hierarchy (Cluster → Region → National Community), enabling multi-level reporting and analysis. Regional coordinators use this linkage to aggregate cycle statistics across all clusters in their region, understanding regional patterns and identifying clusters that need support or recognition. The ClusterId is essential for maintaining the organizational structure of the data and supporting the hierarchical analysis that characterizes strategic planning in community building.

### IsCycleDateChanged (bit, NULL)

A boolean flag indicating whether the cycle's start and end dates have been modified after initial creation. When TRUE, this flag alerts users that the temporal boundaries of the cycle don't match original planning or standard cycle periods, documenting that intentional adjustments were made. Cycles occasionally need date adjustments to accommodate local circumstances, align with regional reporting schedules, or correct data entry errors.

This flag provides important metadata for understanding cycle statistics, as date modifications affect which activities and enrollments fall within the cycle's boundaries. Analysts examining multi-cycle trends need to know when cycles have non-standard durations or boundaries, as this affects comparisons and calculations of growth rates or activity levels.

### IsLocalityDataChanged (bit, NULL)

A boolean flag indicating that underlying locality-level data was modified after the cycle statistics were initially calculated. When TRUE, this flag suggests that the cycle statistics may need recalculation to reflect current data, or that manual overrides may be in effect to preserve specific statistics despite underlying data changes. This flag helps maintain awareness of data currency and the relationship between cycle summaries and their source data.

Changes to locality data might include corrections to activity records, updates to individual participant records, or adjustments to locality boundaries that affect which data aggregates into which cluster's cycles. The flag provides audit trail information useful for data quality management and understanding the history of cycle records.

### IsRecalculated (bit, NULL)

A boolean flag indicating that cycle statistics have been recalculated from source data after initial creation. When TRUE, this flag documents that the statistics reflect a refresh from underlying activity and individual records rather than the original values entered or calculated when the cycle was first created. Recalculation typically occurs when data quality improvements in source tables make cycle statistics more accurate.

This flag is particularly important when override flags are FALSE, as it indicates that the current statistics come from recent calculations rather than potentially outdated initial values. Understanding recalculation status helps coordinators assess data currency and decide whether additional recalculation might be beneficial.

### GUID (uniqueidentifier, NULL)

A globally unique identifier that remains constant for this cycle record across all systems, synchronization operations, and database instances. Unlike the Id field which is specific to this database instance, the GUID provides a universal reference that can be used to match cycle records across distributed systems, support data synchronization between regional and national databases, and maintain record identity through export/import cycles. This field is essential for maintaining data integrity in distributed database scenarios where multiple SRP installations need to share or synchronize cycle statistics.

### LegacyId (nvarchar, NOT NULL)

Preserves the original identifier from legacy statistical reporting systems during migration processes, maintaining a link to historical records and supporting gradual transition scenarios. When data is migrated from older SRP versions or predecessor systems, this field captures the original cycle identifier, enabling cross-reference to archived reports and historical documentation that might reference the old identifier system.

### InstituteId (nvarchar, NOT NULL)

An external identifier that links this cycle to records in separate institute or regional coordination systems that might be used alongside the SRP database. Some regions maintain specialized systems for tracking educational processes or cycle planning, and this field maintains the connection between comprehensive SRP cycle statistics and those external coordination systems. This field supports interoperability in multi-system environments.

### Comments (nvarchar, NOT NULL)

A free-text field for capturing additional context, explanations, or notes about the cycle that don't fit into the structured statistical fields. Coordinators use this field to document special circumstances affecting cycle statistics, explain unusual patterns or deviations from expectations, note data quality issues or gaps, or preserve institutional memory about significant events or changes during the cycle. The comments field provides essential qualitative context that helps interpret the quantitative statistics, supporting more nuanced understanding of cluster development.

### CreatedTimestamp (datetime, NULL)

Records the exact moment when this cycle record was first created in the database. This audit timestamp is crucial for understanding data entry patterns, tracking system usage over time, and troubleshooting data quality issues. It documents when the cycle record was established, which might be during the cycle itself, at its conclusion, or retrospectively when entering historical data. The timestamp supports audit trails and helps administrators understand the history of data entry.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that created this cycle record, providing accountability and traceability in the data entry process. This field maintains a clear chain of responsibility for data creation, enabling administrators to track who is entering cycle statistics, identify training needs, and investigate any data quality questions. In multi-user environments with various coordinators and administrators entering cycle data, this field ensures accountability.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when any field in this cycle record was modified, providing a critical audit trail for data changes. This timestamp automatically updates whenever any change occurs, helping administrators understand data freshness, identify recently modified records, and track patterns of updates. The field is particularly useful for understanding when cycle statistics were last refreshed or corrected.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this cycle record, completing the audit trail for changes. Together with LastUpdatedTimestamp, this field provides full visibility into who is maintaining and updating cycle statistics, supporting accountability and enabling administrators to follow up on changes when necessary. This is crucial in distributed systems where multiple users might update cycle records.

### ImportedTimestamp (datetime, NOT NULL)

For cycle records that were imported from external systems rather than entered directly, this field captures when the import occurred. This timestamp is distinct from CreatedTimestamp, as it specifically marks when data was brought in from another system, such as regional compilations, national office systems, or predecessor SRP versions. This field is crucial for understanding data provenance and tracking migration efforts.

### ImportedFrom (uniqueidentifier, NOT NULL)

Identifies the source system or import batch from which this cycle record originated, using a GUID that can be traced back to specific import operations or source systems. This field enables administrators to track data lineage, understand which records came from which sources, and potentially trace back to original systems if questions arise about data accuracy or completeness. In data consolidation scenarios, this field maintains the critical link to data origins.

### ImportedFileType (varchar, NOT NULL)

Documents the format or type of file from which cycle data was imported, such as "CSV", "Excel", "SRP_3_1_Region_File", or other format identifiers. This information is valuable for understanding the import process, troubleshooting format-specific issues, and maintaining documentation about data sources and migration processes. The field helps administrators understand the technical history of imported records.

## Key Relationships

1. **Clusters** (ClusterId → Clusters.Id)
   - Each cycle record belongs to exactly one cluster
   - Enables tracking of cluster progress over time

## Data Categories

The Cycles table organizes data into several major categories:

### 1. Book Completion Statistics
Tracks progress through the Ruhi Institute curriculum sequence:
- **Books 1-7**: Main sequence of institute courses
- **Book 3**: Has three grades (G1, G2, G3) for children's class teacher training
- **Book 9**: Has two units (U1, U2) for advanced study
- These metrics show educational advancement in the cluster

### 2. Core Activities Statistics
The four core activities of community building:

**Devotional Meetings**
- Gatherings for prayer and spiritual reflection
- Open to all community members
- Tracks number, attendance, and friends of the faith participation

**Children's Classes**
- Spiritual education for ages 5-11
- Tracks number of classes, total attendance, and non-Bahai children

**Junior Youth Groups**
- Empowerment program for ages 12-15
- Tracks groups, participants, and friends of the faith

**Study Circles**
- Adult education programs
- Sequential study of institute materials
- Tracks circles, participants, and friends of the faith

### 3. Expansion Metrics
Growth indicators for the cycle:
- **FriendsParticipatingInExpansionPhase**: Active participants in teaching efforts
- **ChildrenAndJuniorYouthRegisteredDuringCycle**: New young enrollments
- **YouthAndAdultsEnrolledDuringCycle**: New adult enrollments
- **NewlyEnrolledBelieversInInstituteProcess**: New believers entering education process

### 4. Population Demographics
Complete demographic breakdown:
- Age categories: Children, Junior Youth, Youth, Adults
- Gender breakdown: Adult Men and Women
- Total population for reference and calculation

### 5. Community Development Indicators
Measures of community life vitality:
- **HomesVisitedForDeepening**: Home-based spiritual education visits
- **NineteenDayFeastAttendance**: Monthly Bahai community gathering
- **HolyDayObservances**: Celebration of Bahai Holy Days
- Tracks both number of localities and attendance estimates

## Override Mechanism

The table includes six override flags that allow manual correction of calculated data:
1. **IsOverrideCompletedBookData**: Override institute completion statistics
2. **IsOverrideDevotionalMeetingsData**: Override devotional meeting counts
3. **IsOverrideJuniorYouthGroupsData**: Override junior youth statistics
4. **IsOverrideStudyCirclesData**: Override study circle counts
5. **IsOverrideExpansionDuringCycleData**: Override expansion metrics
6. **IsOverrideBahaiPopulationData**: Override population demographics
7. **IsOverrideCommunityDevelopmentData**: Override community life indicators

When an override flag is TRUE, the corresponding data fields were manually entered and should not be recalculated from source data.

## Change Tracking Flags

Three flags track data modifications:
- **IsCycleDateChanged**: Cycle period was adjusted
- **IsLocalityDataChanged**: Underlying locality data was modified
- **IsRecalculated**: Statistics were recomputed from source data

These flags help maintain data integrity and audit trails.

## Common Query Patterns

### Cycle Progression for a Cluster
```sql
SELECT
    [DisplayStartDate],
    [DisplayEndDate],
    [StudyCirclesNumber],
    [JuniorYouthGroupsNumber],
    [ChildrenClassesNumber],
    [DevotionalMeetingsNumber]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Book Completion Trends
```sql
SELECT
    [DisplayStartDate],
    [CompletedBook1],
    [CompletedBook2],
    [CompletedBook3G1],
    [CompletedBook4],
    [CompletedBook5],
    [CompletedBook6],
    [CompletedBook7]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Core Activities Summary
```sql
SELECT
    C.[Name] AS ClusterName,
    CY.[DisplayStartDate],
    CY.[DevotionalMeetingsNumber] + CY.[ChildrenClassesNumber] +
    CY.[JuniorYouthGroupsNumber] + CY.[StudyCirclesNumber] AS [TotalCoreActivities]
FROM [Cycles] CY
INNER JOIN [Clusters] C ON CY.[ClusterId] = C.[Id]
WHERE CY.[StartDate] >= '2024-01-01'
ORDER BY [TotalCoreActivities] DESC
```

### Friends of the Faith Participation
```sql
SELECT
    [DisplayStartDate],
    ([DevotionalMeetingsFriendsOfFaith] +
     [ChildrenClassesFriendsOfFaith] +
     [JuniorYouthGroupsFriendsOfFaith] +
     [StudyCirclesFriendsOfFaith]) AS [TotalFriendsParticipating]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Population Demographics
```sql
SELECT
    [DisplayStartDate],
    [BahaiChildren],
    [BahaiJuniorYouth],
    [BahaiYouth],
    [BahaiAdultMen],
    [BahaiAdultWomen],
    [TotalBahaiBelievers]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

## Business Rules and Constraints

1. **Date Ranges**: EndDate must be after StartDate
2. **Cluster Assignment**: Every cycle must belong to a cluster
3. **Non-Negative Counts**: All numeric statistics should be ≥ 0
4. **Population Totals**: TotalBahaiBelievers should equal sum of demographic categories
5. **Friends of Faith**: Should not exceed total attendance figures
6. **Book Sequence**: Completions generally follow sequence (most Book 1, fewer Book 7)
7. **Override Consistency**: When override flag is true, corresponding data should be manually verified

## Usage in Reporting

The Cycles table is the primary source for:
- **Quarterly Reports**: Cluster statistics for each reporting period
- **Trend Analysis**: Growth patterns over multiple cycles
- **Regional Aggregation**: Rolling up cluster data to regional level
- **Milestone Assessment**: Evaluating cluster development progress
- **Resource Planning**: Identifying needs based on activity levels

## Notes for Developers

- Always join with Clusters to get cluster name and context
- Respect override flags when calculating aggregates
- Use StartDate for chronological sorting and filtering
- Consider both display and actual dates for user interfaces
- NULL values in statistics indicate data not collected for that cycle
- Check change tracking flags to understand data history
- Population demographics help contextualize activity statistics

## Performance Considerations

- Index on ClusterId for cluster-specific queries
- Index on StartDate for time-based analysis
- Large result sets when querying multiple cycles across regions
- Consider date range limits when running aggregations

## Special Notes

### Data Completeness
Not all cycles will have complete data:
- Early cycles may have limited statistics
- Some metrics introduced in later versions of the system
- NULL values are normal and should be handled gracefully

### Calculation vs. Manual Entry
The system can calculate many statistics from activity and individual records, but override flags allow manual entry when:
- Calculated data is incomplete
- External sources have more accurate information
- Data corrections are needed
- Importing from legacy systems
